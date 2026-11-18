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
