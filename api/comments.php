<?php
// GET  /api/comments.php?type=myth&id=<slug> → approved comments
// POST /api/comments.php {type, id, body, nickname, avatar?} → pending comment (moderated)
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();
const BJ_TYPES = ['myth', 'thought', 'post', 'episode'];

function bj_target(array $src): array {
  $type = $src['type'] ?? '';
  $id = bj_str($src['id'] ?? '', 100);
  if (!in_array($type, BJ_TYPES, true) || !preg_match('/^[\w-]{1,100}$/u', $id)) bj_fail('invalid');
  return [$type, $id];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  $in = bj_post_json();
  bj_rate_limit('comment', 10, 600);
  [$type, $id] = bj_target($in);
  $body = bj_str($in['body'] ?? '', 1000);
  $me = bj_user();
  $prof = $me && $me['profile'] ? (json_decode($me['profile'], true) ?: []) : [];
  $nick = ($prof['nickname'] ?? '') ?: bj_str($in['nickname'] ?? '', 40);
  if ($me && isset($prof['avatar'])) $in['avatar'] = $prof['avatar'];
  if (mb_strlen($body) < 2 || $nick === '') bj_fail('invalid');
  $avatar = isset($in['avatar']) && is_array($in['avatar']) ? json_encode($in['avatar'], JSON_UNESCAPED_UNICODE) : null;
  if ($avatar !== null && strlen($avatar) > 2000) $avatar = null;
  $db->prepare('INSERT INTO comments (target_type, target_id, nickname, avatar, body, ip_hash, user_id) VALUES (?,?,?,?,?,?,?)')
    ->execute([$type, $id, $nick, $avatar, $body, bj_ip_hash(), $me ? (int)$me['id'] : null]);
  bj_out(['id' => (string)$db->lastInsertId(), 'target' => ['type' => $type, 'id' => $id], 'nickname' => $nick,
    'avatar' => $avatar ? json_decode($avatar, true) : null, 'body' => $body, 'status' => 'pending', 'createdAt' => gmdate('c'), 'mine' => true], 201);
}

[$type, $id] = bj_target($_GET);
$st = $db->prepare("SELECT id, nickname, avatar, body, created_at FROM comments WHERE target_type = ? AND target_id = ? AND status = 'approved' ORDER BY created_at LIMIT 200");
$st->execute([$type, $id]);
bj_out(['comments' => array_map(fn($r) => [
  'id' => (string)$r['id'], 'target' => ['type' => $type, 'id' => $id], 'nickname' => $r['nickname'],
  'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'body' => $r['body'], 'status' => 'approved',
  'createdAt' => gmdate('c', strtotime($r['created_at'])),
], $st->fetchAll())]);
