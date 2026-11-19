<?php
// GET /api/profile.php?u=<handle> → public profile of a server account.
// Private profiles (and every 13-17 profile) show only to their owner.
// Age band, district, school, email and parent email are never public.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

$h = strtolower(bj_str($_GET['u'] ?? '', 20));
if (!preg_match('/^[a-z0-9_]{3,20}$/', $h)) bj_fail('invalid');
$st = $db->prepare("SELECT id, username, profile, created_at, role, disabled FROM users WHERE username = ?");
$st->execute([$h]);
$u = $st->fetch();
if (!$u || (int)$u['disabled'] === 1) bj_fail('not_found', 404);
$p = json_decode((string)$u['profile'], true) ?: [];
$me = bj_user();
$own = $me && (int)$me['id'] === (int)$u['id'];
$public = !empty($p['isPublic']) && ($p['ageBand'] ?? '') === '18+';
if (!$public && !$own) bj_out(['private' => true, 'username' => $u['username']]);

$uid = (int)$u['id'];
$q = $db->prepare('SELECT quiz_slug, MAX(score) AS best, MAX(total) AS total, COUNT(*) AS plays, SUM(points) AS points FROM quiz_attempts WHERE user_id = ? GROUP BY quiz_slug ORDER BY MAX(created_at) DESC LIMIT 30');
$q->execute([$uid]);
$pi = $db->prepare('SELECT code, title, status FROM pitches WHERE user_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 20');
$pi->execute([$uid]);
$c = $db->prepare("SELECT target_type, target_id, body, created_at FROM comments WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 20");
$c->execute([$uid]);

bj_out([
  'username' => $u['username'],
  'nickname' => $p['nickname'] ?? $u['username'],
  'realName' => (!empty($p['showRealName']) && $public) ? ($p['realName'] ?? null) : null,
  'bio' => $p['bio'] ?? null,
  'avatar' => $p['avatar'] ?? null,
  'interests' => $p['interests'] ?? [],
  'badges' => $p['badges'] ?? [],
  'points' => (int)($p['points'] ?? 0),
  'core' => $u['role'] === 'core',
  'joined' => gmdate('c', strtotime($u['created_at'])),
  'own' => $own,
  'private' => !$public,
  'quizzes' => array_map(fn($r) => ['slug' => $r['quiz_slug'], 'best' => (int)$r['best'], 'total' => (int)$r['total'], 'plays' => (int)$r['plays'], 'points' => (int)$r['points']], $q->fetchAll()),
  'pitches' => $pi->fetchAll(),
  'comments' => array_map(fn($r) => ['target' => ['type' => $r['target_type'], 'id' => $r['target_id']], 'body' => $r['body'], 'createdAt' => gmdate('c', strtotime($r['created_at']))], $c->fetchAll()),
]);
