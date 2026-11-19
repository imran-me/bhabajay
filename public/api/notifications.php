<?php
// GET  /api/notifications.php           → {unread, items:[{id,kind,title,body,href,read,createdAt}]}
// POST {action:'read', id?}             → mark one (or all) read
// Signed-in only. "Keys refilled" is created lazily on the first visit of a new Dhaka day.
declare(strict_types=1);
require __DIR__ . '/_notify.php';

$u = bj_user();
if (!$u) bj_out(['unread' => 0, 'items' => []]);
$db = bj_db();
$uid = (int)$u['id'];

try {
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $in = bj_post_json();
    bj_rate_limit('notify', 120, 600);
    if (isset($in['id'])) $db->prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND id = ? AND read_at IS NULL')->execute([$uid, (int)$in['id']]);
    else $db->prepare('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL')->execute([$uid]);
    bj_out(['ok' => true]);
  }
  // keys refilled: only for people who used keys before today
  $today = (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
  try {
    $st = $db->prepare('SELECT 1 FROM content_unlocks WHERE user_id = ? AND unlock_day < ? LIMIT 1');
    $st->execute([$uid, $today]);
    if ($st->fetchColumn()) bj_notify($uid, 'keys', 'নতুন চাবি এসেছে! 🔑', 'প্রতিটা সিরিজে আজ আবার ২টা করে চাবি।', '/series', "keys-$today");
  } catch (PDOException $e) { /* unlock tables not ready */ }
  $st = $db->prepare('SELECT id, kind, title, body, href, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30');
  $st->execute([$uid]);
  $items = array_map(fn($r) => ['id' => (int)$r['id'], 'kind' => $r['kind'], 'title' => $r['title'], 'body' => $r['body'], 'href' => $r['href'],
    'read' => $r['read_at'] !== null, 'createdAt' => gmdate('c', strtotime($r['created_at']))], $st->fetchAll());
  $st = $db->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL');
  $st->execute([$uid]);
  bj_out(['unread' => (int)$st->fetchColumn(), 'items' => $items]);
} catch (PDOException $e) {
  if (in_array((string)$e->getCode(), ['42S02', '42S22'], true)) bj_out(['unread' => 0, 'items' => []]);
  throw $e;
}
