<?php
// Small helpers shared by the API endpoints: JSON out, safe errors, same-origin
// JSON-only POSTs (CSRF-safe: cross-site forms cannot send application/json
// without a CORS preflight, which we never grant), per-IP rate limits, validation.
declare(strict_types=1);
require_once __DIR__ . '/_db.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function bj_out($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function bj_fail(string $error, int $code = 400): void { bj_out(['error' => $error], $code); }

set_exception_handler(function (Throwable $e) {
  error_log('[bj-api] ' . $e->getMessage());
  bj_fail('server', 500);
});

function bj_ip_hash(): string {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  return hash('sha256', 'bj|' . $ip . '|' . gmdate('Y-m'));
}

/** Read a same-origin JSON POST body or fail. */
function bj_post_json(): array {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') bj_fail('method', 405);
  $ct = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($ct, 'application/json') !== 0) bj_fail('content-type', 415);
  $host = $_SERVER['HTTP_HOST'] ?? '';
  $origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== preg_replace('/:\d+$/', '', $host)) bj_fail('origin', 403);
  // signed-in requests must carry the session's CSRF token
  if (bj_user()) bj_check_csrf();
  $raw = file_get_contents('php://input', false, null, 0, 65536);
  $data = json_decode($raw ?: '', true);
  if (!is_array($data)) bj_fail('json');
  return $data;
}

/** Allow $max hits per $seconds for this IP + bucket name. */
function bj_rate_limit(string $name, int $max, int $seconds): void {
  $db = bj_db();
  $key = $name . ':' . substr(bj_ip_hash(), 0, 40);
  $now = time();
  $db->prepare('INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?)
    ON DUPLICATE KEY UPDATE hits = IF(window_start < ?, 1, hits + 1), window_start = IF(window_start < ?, VALUES(window_start), window_start)')
    ->execute([$key, $now, $now - $seconds, $now - $seconds]);
  $st = $db->prepare('SELECT hits FROM rate_limits WHERE bucket = ?');
  $st->execute([$key]);
  if ((int)$st->fetchColumn() > $max) bj_fail('rate', 429);
}

/** Trimmed string with a max length; '' when missing. */
function bj_str($v, int $max): string {
  if (!is_string($v)) return '';
  $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? '');
  return mb_substr($v, 0, $max);
}

function bj_slug($v): string {
  $v = is_string($v) ? $v : '';
  return preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $v) ? $v : '';
}

/* ───────── Sessions, accounts, CSRF ───────── */

function bj_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_name('BJSESS');
  session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 60, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 60));
  session_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

/** Logged-in user row (id, email, role, username, profile) or null. Only starts a session if the cookie exists. */
function bj_user(): ?array {
  static $u = false;
  if ($u !== false) return $u;
  if (empty($_COOKIE['BJSESS']) && session_status() !== PHP_SESSION_ACTIVE) return $u = null;
  bj_session();
  if (empty($_SESSION['uid'])) return $u = null;
  $st = bj_db()->prepare('SELECT id, email, role, username, profile, created_at FROM users WHERE id = ?');
  $st->execute([(int)$_SESSION['uid']]);
  return $u = ($st->fetch() ?: null);
}

/** For POSTs made while signed in: the X-CSRF-Token header must match the session token. */
function bj_check_csrf(): void {
  if (session_status() !== PHP_SESSION_ACTIVE) return;
  $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
  if (!is_string($sent) || !hash_equals($_SESSION['csrf'] ?? '', $sent)) bj_fail('csrf', 403);
}

function bj_require_user(): array {
  $u = bj_user();
  if (!$u) bj_fail('login', 401);
  bj_check_csrf();
  return $u;
}

function bj_require_admin(): array {
  $u = bj_require_user();
  if ($u['role'] !== 'core') bj_fail('forbidden', 403);
  return $u;
}

/** Public shape the site stores as LocalUser. */
function bj_public_user(array $u): ?array {
  $p = $u['profile'] ? json_decode($u['profile'], true) : null;
  if (!is_array($p)) return null;
  return array_merge($p, [
    'id' => 'u' . $u['id'], 'email' => $u['email'], 'username' => $u['username'], 'role' => $u['role'] === 'core' ? 'core' : 'member',
    'method' => 'magic', 'createdAt' => gmdate('c', strtotime($u['created_at'])),
  ]);
}

/**
 * First admin, one time: the owner puts ADMIN_EMAIL=you@example.com in
 * $HOME/bhabajay-deploy/admin.env. While NO admin exists, the account with that
 * email becomes admin when it signs in. Afterwards the file is ignored (delete it).
 */
function bj_maybe_promote(array $u): void {
  if ($u['role'] === 'core') return;
  $f = null;
  foreach ([dirname(__DIR__, 2), dirname(__DIR__, 3), dirname(__DIR__, 4)] as $d) {
    if (is_readable("$d/bhabajay-deploy/admin.env")) { $f = "$d/bhabajay-deploy/admin.env"; break; }
  }
  if (!$f) return;
  $env = parse_ini_file($f, false, INI_SCANNER_RAW) ?: [];
  $want = strtolower(trim($env['ADMIN_EMAIL'] ?? ''));
  if ($want === '' || $want !== strtolower($u['email'])) return;
  $db = bj_db();
  if ((int)$db->query("SELECT COUNT(*) FROM users WHERE role = 'core'")->fetchColumn() > 0) return;
  $db->prepare("UPDATE users SET role = 'core' WHERE id = ?")->execute([$u['id']]);
}
