<?php
// GET /api/leaderboard.php?period=week|all[&district=<name>]
// Accounts ranked by points (quiz + unlocks + bonuses). Never shows age; district only
// for people who allowed it (profile.showDistrict, 18+), and the filter uses only them.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

$week = ($_GET['period'] ?? 'all') === 'week';
$district = bj_str($_GET['district'] ?? '', 64);
$since = $week ? gmdate('Y-m-d H:i:s', time() - 7 * 86400) : '1970-01-01 00:00:00';

$parts = [
  'SELECT user_id, points AS p FROM quiz_attempts WHERE user_id IS NOT NULL AND created_at >= ?',
  'SELECT user_id, points AS p FROM content_unlocks WHERE user_id IS NOT NULL AND unlocked_at >= ?',
  'SELECT user_id, points AS p FROM bonus_points WHERE created_at >= ?',
];
$rows = null;
// tolerate tables that the DB sync has not created yet: drop them one by one
for ($n = count($parts); $n >= 1 && $rows === null; $n--) {
  $sql = 'SELECT t.user_id, SUM(t.p) AS score, u.username, u.profile FROM (' . implode(' UNION ALL ', array_slice($parts, 0, $n)) . ') t
    JOIN users u ON u.id = t.user_id AND u.disabled = 0 GROUP BY t.user_id, u.username, u.profile HAVING score > 0 ORDER BY score DESC LIMIT 300';
  try {
    $st = $db->prepare($sql);
    $st->execute(array_fill(0, $n, $since));
    $rows = $st->fetchAll();
  } catch (PDOException $e) {
    if (!in_array((string)$e->getCode(), ['42S02', '42S22'], true)) throw $e;
  }
}
$rows ??= [];

$me = bj_user();
$out = [];
$districts = [];
foreach ($rows as $r) {
  $p = json_decode((string)$r['profile'], true) ?: [];
  $adult = ($p['ageBand'] ?? '') === '18+';
  $d = ($adult && !empty($p['showDistrict']) && !empty($p['district'])) ? $p['district'] : null;
  if ($d) $districts[$d] = true;
  if ($district !== '' && $d !== $district) continue;
  $public = $adult && !empty($p['isPublic']);
  $out[] = [
    'rank' => count($out) + 1,
    'name' => $p['nickname'] ?? 'ভাবুক',
    'username' => $public ? $r['username'] : null,
    'avatar' => $p['avatar'] ?? null,
    'district' => $d,
    'score' => (int)$r['score'],
    'me' => $me && (int)$me['id'] === (int)$r['user_id'],
  ];
  if (count($out) >= 100) break;
}
ksort($districts);
header('Cache-Control: private, max-age=60');
bj_out(['period' => $week ? 'week' : 'all', 'rows' => $out, 'districts' => array_keys($districts)]);
