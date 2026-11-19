<?php
// POST /api/scores.php  {quizSlug, score, total, points, durationMs, nickname, schoolId?, district?}
// GET  /api/scores.php?count=<quizSlug>        → {count}
// GET  /api/scores.php?board=people|schools|districts[&quiz=slug] → {rows:[{rank,name,sub,score,plays}]}
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  $in = bj_post_json();
  bj_rate_limit('score', 60, 3600);
  $slug = bj_slug($in['quizSlug'] ?? '');
  $total = (int)($in['total'] ?? 0);
  $score = (int)($in['score'] ?? -1);
  $points = (int)($in['points'] ?? -1);
  if ($slug === '' || $total < 1 || $total > 50 || $score < 0 || $score > $total || $points < 0 || $points > $total * 20) bj_fail('invalid');
  $me = bj_user();
  $prof = $me && $me['profile'] ? (json_decode($me['profile'], true) ?: []) : [];
  $nick = ($prof['nickname'] ?? '') ?: (bj_str($in['nickname'] ?? '', 40) ?: 'অতিথি');
  if ($me) { $in['schoolId'] = $prof['schoolId'] ?? null; $in['district'] = $prof['district'] ?? null; }
  $db->prepare('INSERT INTO quiz_attempts (quiz_slug, nickname, school_id, district, score, total, points, duration_ms, ip_hash, user_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
    ->execute([str_starts_with($slug, 'weekly') ? 'weekly' : $slug, $nick, bj_str($in['schoolId'] ?? '', 64) ?: null, bj_str($in['district'] ?? '', 64) ?: null,
      $score, $total, $points, max(0, min(3600000, (int)($in['durationMs'] ?? 0))), bj_ip_hash(), $me ? (int)$me['id'] : null]);
  bj_out(['ok' => true], 201);
}

if (isset($_GET['count'])) {
  $slug = bj_slug($_GET['count']);
  if ($slug === '') bj_fail('invalid');
  $st = $db->prepare('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_slug = ?');
  $st->execute([str_starts_with($slug, 'weekly') ? 'weekly' : $slug]);
  bj_out(['count' => (int)$st->fetchColumn()]);
}

$board = $_GET['board'] ?? 'people';
$col = ['people' => 'nickname', 'schools' => 'school_id', 'districts' => 'district'][$board] ?? null;
if (!$col) bj_fail('invalid');
$quiz = bj_slug($_GET['quiz'] ?? '');
$sql = "SELECT $col AS name, MAX(district) AS sub, SUM(points) AS score, COUNT(*) AS plays FROM quiz_attempts WHERE $col IS NOT NULL"
  . ($quiz ? ' AND quiz_slug = ?' : '') . " GROUP BY $col ORDER BY score DESC LIMIT 100";
if ($board === 'people' && !$quiz) {
  // overall people board also counts points from daily unlocks and bonuses
  $sql = "SELECT name, MAX(sub) AS sub, SUM(score) AS score, SUM(plays) AS plays FROM (
      SELECT nickname AS name, district AS sub, points AS score, 1 AS plays FROM quiz_attempts
      UNION ALL SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.nickname')), NULL, c.points, 0 FROM content_unlocks c JOIN users u ON u.id = c.user_id WHERE c.points > 0
      UNION ALL SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.nickname')), NULL, b.points, 0 FROM bonus_points b JOIN users u ON u.id = b.user_id
    ) t WHERE name IS NOT NULL GROUP BY name ORDER BY score DESC LIMIT 100";
}
$args = $quiz ? [str_starts_with($quiz, 'weekly') ? 'weekly' : $quiz] : [];
try {
  $st = $db->prepare($sql);
  $st->execute($args);
} catch (PDOException $e) {
  if (!in_array((string)$e->getCode(), ['42S02', '42S22'], true)) throw $e;
  // unlock tables not created yet: quiz points only
  $st = $db->prepare("SELECT $col AS name, MAX(district) AS sub, SUM(points) AS score, COUNT(*) AS plays FROM quiz_attempts WHERE $col IS NOT NULL"
    . ($quiz ? ' AND quiz_slug = ?' : '') . " GROUP BY $col ORDER BY score DESC LIMIT 100");
  $st->execute($args);
}
$rows = [];
foreach ($st->fetchAll() as $i => $r) {
  $rows[] = ['rank' => $i + 1, 'name' => $r['name'], 'sub' => $board === 'districts' ? null : $r['sub'], 'score' => (int)$r['score'], 'plays' => (int)$r['plays']];
}
header('Cache-Control: public, max-age=60');
bj_out(['rows' => $rows]);
