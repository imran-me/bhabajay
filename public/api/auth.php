<?php
// Bhaba Jay ID (server accounts).
// GET  /api/auth.php                    → {user, email, csrf}  (user = null until the profile is saved)
// GET  /api/auth.php?username=x         → {available}
// POST {action:'register'|'login', email, password}
// POST {action:'profile', profile:{...}}   (signed in, X-CSRF-Token)
// POST {action:'logout'} | {action:'delete'} (signed in, X-CSRF-Token)
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

function bj_me_out(?array $u, int $code = 200): void {
  bj_session();
  bj_out(['user' => $u ? bj_public_user($u) : null, 'email' => $u['email'] ?? null, 'csrf' => $_SESSION['csrf']], $code);
}

function bj_load_user(int $id): array {
  $st = bj_db()->prepare('SELECT id, email, role, username, profile, created_at FROM users WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch();
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  if (isset($_GET['username'])) {
    $name = strtolower(bj_str($_GET['username'], 20));
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $name)) bj_out(['available' => false]);
    $st = $db->prepare('SELECT id FROM users WHERE username = ?');
    $st->execute([$name]);
    $row = $st->fetch();
    $me = bj_user();
    bj_out(['available' => !$row || ($me && (int)$row['id'] === (int)$me['id'])]);
  }
  bj_me_out(bj_user());
}

$in = bj_post_json();
$action = $in['action'] ?? '';

if ($action === 'register' || $action === 'login') {
  bj_rate_limit('auth', 10, 900);
  $email = strtolower(bj_str($in['email'] ?? '', 200));
  $pass = is_string($in['password'] ?? null) ? $in['password'] : '';
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) bj_fail('email');
  if (strlen($pass) < 8 || strlen($pass) > 200) bj_fail('password');
  $st = $db->prepare('SELECT id, pass_hash, disabled FROM users WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  if ($action === 'register') {
    if ($row) bj_fail('exists', 409);
    $db->prepare('INSERT INTO users (email, pass_hash) VALUES (?, ?)')->execute([$email, password_hash($pass, PASSWORD_DEFAULT)]);
    $id = (int)$db->lastInsertId();
  } else {
    if (!$row || !password_verify($pass, $row['pass_hash'])) bj_fail('credentials', 401);
    if ((int)$row['disabled'] === 1) bj_fail('disabled', 403);
    $id = (int)$row['id'];
    if (password_needs_rehash($row['pass_hash'], PASSWORD_DEFAULT)) {
      $db->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $id]);
    }
  }
  bj_session();
  session_regenerate_id(true);
  $_SESSION['uid'] = $id;
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$id]);
  bj_maybe_promote(bj_load_user($id));
  bj_me_out(bj_load_user($id), $action === 'register' ? 201 : 200);
}

$u = bj_require_user();

if ($action === 'logout') {
  $_SESSION = [];
  session_destroy();
  setcookie('BJSESS', '', ['expires' => 1, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
  bj_out(['ok' => true]);
}

if ($action === 'delete') {
  $db->prepare('DELETE FROM comments WHERE user_id = ?')->execute([$u['id']]);
  $db->prepare('DELETE FROM quiz_attempts WHERE user_id = ?')->execute([$u['id']]);
  $db->prepare('UPDATE pitches SET user_id = NULL WHERE user_id = ?')->execute([$u['id']]);
  $db->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
  $_SESSION = [];
  session_destroy();
  bj_out(['ok' => true]);
}

if ($action === 'stats') {
  // badges + points earned in the browser, shown on the public profile
  $prof = $u['profile'] ? (json_decode($u['profile'], true) ?: []) : null;
  if (!is_array($prof)) bj_out(['ok' => false]);
  $prof['badges'] = array_values(array_slice(array_filter(is_array($in['badges'] ?? null) ? $in['badges'] : [], fn($x) => is_string($x) && preg_match('/^[a-z0-9-]{1,40}$/', $x)), 0, 80));
  $prof['points'] = max(0, min(10000000, (int)($in['points'] ?? 0)));
  $db->prepare('UPDATE users SET profile = ? WHERE id = ?')->execute([json_encode($prof, JSON_UNESCAPED_UNICODE), $u['id']]);
  bj_out(['ok' => true]);
}

if ($action === 'profile') {
  $p = is_array($in['profile'] ?? null) ? $in['profile'] : bj_fail('invalid');
  $username = strtolower(bj_str($p['username'] ?? '', 20));
  $nick = bj_str($p['nickname'] ?? '', 30);
  $age = $p['ageBand'] ?? '';
  if (!preg_match('/^[a-z0-9_]{3,20}$/', $username) || mb_strlen($nick) < 2 || !in_array($age, ['13-17', '18+'], true)) bj_fail('invalid');
  $prev = $u['profile'] ? (json_decode($u['profile'], true) ?: []) : [];
  $adult = $age === '18+';
  $parentOk = $adult || !empty($prev['parentConfirmed']);
  $clean = [
    'nickname' => $nick,
    'ageBand' => $age,
    'parentEmail' => $adult ? null : (filter_var(bj_str($p['parentEmail'] ?? '', 200), FILTER_VALIDATE_EMAIL) ?: bj_fail('parent')),
    'parentConfirmed' => $parentOk,
    // teen privacy: never a public real name / school / district without the parent's OK
    'isPublic' => $adult && !empty($p['isPublic']),
    'showRealName' => $adult && !empty($p['showRealName']),
    'realName' => $adult ? (bj_str($p['realName'] ?? '', 60) ?: null) : null,
    'district' => $parentOk ? (bj_str($p['district'] ?? '', 64) ?: null) : null,
    'schoolId' => $parentOk ? (bj_str($p['schoolId'] ?? '', 64) ?: null) : null,
    'bio' => bj_str($p['bio'] ?? '', 300) ?: null,
    'interests' => array_values(array_slice(array_filter(is_array($p['interests'] ?? null) ? $p['interests'] : [], fn($x) => is_string($x) && preg_match('/^[a-z0-9-]{1,64}$/', $x)), 0, 12)),
    'badges' => array_values(array_slice(array_filter(is_array($p['badges'] ?? null) ? $p['badges'] : [], fn($x) => is_string($x) && preg_match('/^[a-z0-9-]{1,40}$/', $x)), 0, 80)),
    'points' => max(0, min(10000000, (int)($p['points'] ?? ($prev['points'] ?? 0)))),
    'avatar' => is_array($p['avatar'] ?? null) ? array_map(fn($v) => is_scalar($v) ? mb_substr((string)$v, 0, 40) : null, array_slice($p['avatar'], 0, 12, true)) : new stdClass(),
  ];
  try {
    $db->prepare('UPDATE users SET username = ?, profile = ? WHERE id = ?')
      ->execute([$username, json_encode(array_filter($clean, fn($v) => $v !== null), JSON_UNESCAPED_UNICODE), $u['id']]);
  } catch (PDOException $e) {
    if ($e->getCode() === '23000') bj_fail('username', 409);
    throw $e;
  }
  bj_me_out(bj_load_user((int)$u['id']));
}

bj_fail('action');
