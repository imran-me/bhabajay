<?php
// Daily unlocks ("ভাবুর চাবি"). Limits and points are decided here only.
// GET  ?series=<slug>              → keys left today, unlocked + free slugs, reset time
// GET  ?left=<slug,slug,...>       → keys left today per series (for suggestions)
// GET  ?mystery=1                  → today's "আজকের রহস্য" card (double points)
// POST {action:'unlock', series, item, guess?:'myth'|'true'} → the opened card + points
// POST {action:'share', series, item} → +BJ_POINTS_SHARE once per Dhaka day (signed in)
declare(strict_types=1);
require __DIR__ . '/_content.php';
require __DIR__ . '/_unlock.php';
require_once __DIR__ . '/_notify.php';
header('Cache-Control: private, no-store');
$db = bj_db();
// zero-downtime: until the DB sync has created the unlock tables, answer a friendly 503
set_exception_handler(function (Throwable $e) {
  if (bj_missing_schema($e)) {
    http_response_code(503);
    header('Retry-After: 300');
    echo json_encode(['error' => 'not_ready', 'message' => 'একটু পরে আবার চেষ্টা করো'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  error_log('[bj-api] ' . $e->getMessage());
  bj_fail('server', 500);
});

function bj_series_ok(string $s): bool {
  if ($s === BJ_MYTH_SERIES) return true;
  $st = bj_db()->prepare('SELECT 1 FROM bj_posts WHERE series_slug = ? LIMIT 1');
  $st->execute([$s]);
  return (bool)$st->fetchColumn();
}

/** today's featured locked card: deterministic per Dhaka day, never a free card */
function bj_mystery(): ?array {
  $rows = bj_db()->query("SELECT p.series_slug AS seriesSlug, p.slug, p.title, p.images FROM bj_posts p
    WHERE p.hidden = 0 AND JSON_LENGTH(p.images) > 0 AND (SELECT COUNT(*) FROM bj_posts q WHERE q.series_slug = p.series_slug AND q.hidden = 0
      AND (q.published_at < p.published_at OR (q.published_at = p.published_at AND q.id < p.id))) >= " . BJ_FREE_PER_SERIES . "
    ORDER BY p.id")->fetchAll();
  if (!$rows) return null;
  $r = $rows[crc32('mystery|' . bj_dhaka_day()) % count($rows)];
  $img = json_decode((string)$r['images'], true) ?: [];
  return ['seriesSlug' => $r['seriesSlug'], 'slug' => $r['slug'], 'title' => $r['title'], 'image' => $img[0] ?? null];
}

/** total server points of a user (unlocks + bonuses) */
function bj_unlock_points(int $uid): int {
  $st = bj_db()->prepare('SELECT (SELECT COALESCE(SUM(points),0) FROM content_unlocks WHERE user_id = ?) + (SELECT COALESCE(SUM(points),0) FROM bonus_points WHERE user_id = ?)');
  $st->execute([$uid, $uid]);
  return (int)$st->fetchColumn();
}

const BJ_STREAK_BONUS_DAYS = [3, 7, 30];

/** consecutive Dhaka days with at least one unlock, ending yesterday */
function bj_streak_before_today(?int $uid): int {
  if (!$uid) return 0;
  try {
    $st = bj_db()->prepare('SELECT DISTINCT unlock_day FROM content_unlocks WHERE user_id = ? AND unlock_day < ? ORDER BY unlock_day DESC LIMIT 40');
    $st->execute([$uid, bj_dhaka_day()]);
    $days = $st->fetchAll(PDO::FETCH_COLUMN);
  } catch (PDOException $e) { if (bj_missing_schema($e)) return 0; throw $e; }
  $d = bj_dhaka_now()->modify('-1 day');
  $n = 0;
  foreach ($days as $day) {
    if ($day !== $d->format('Y-m-d')) break;
    $n++;
    $d->modify('-1 day');
  }
  return $n;
}

function bj_unlocked_today_any(?int $uid): bool {
  if (!$uid) return false;
  $st = bj_db()->prepare('SELECT 1 FROM content_unlocks WHERE user_id = ? AND unlock_day = ? LIMIT 1');
  $st->execute([$uid, bj_dhaka_day()]);
  return (bool)$st->fetchColumn();
}

/** today's extra key from a 3/7/30-day streak, usable in any one series */
function bj_bonus_key(?int $uid): bool {
  if (!$uid || !in_array(bj_streak_before_today($uid) + 1, BJ_STREAK_BONUS_DAYS, true)) return false;
  try {
    $st = bj_db()->prepare('SELECT 1 FROM content_unlocks WHERE user_id = ? AND unlock_day = ? AND bonus = 1 LIMIT 1');
    $st->execute([$uid, bj_dhaka_day()]);
    return !$st->fetchColumn();
  } catch (PDOException $e) { if (bj_missing_schema($e)) return false; throw $e; }
}

function bj_state(array $o, string $series): array {
  $used = bj_used_today($o, $series);
  $bonus = bj_bonus_key($o['user']);
  $streak = bj_streak_before_today($o['user']) + (bj_unlocked_today_any($o['user']) ? 1 : 0);
  return ['series' => $series, 'limit' => BJ_UNLOCKS_PER_DAY, 'used' => $used, 'left' => max(0, BJ_UNLOCKS_PER_DAY - $used) + ($bonus ? 1 : 0),
    'bonusKey' => $bonus, 'streak' => $streak,
    'resetsAt' => bj_next_reset(), 'signedIn' => (bool)$o['user'],
    'rules' => ['unlock' => BJ_POINTS_UNLOCK, 'guessBonus' => BJ_POINTS_GUESS_BONUS, 'share' => BJ_POINTS_SHARE, 'mysteryMultiplier' => BJ_POINTS_DAILY_MYSTERY]];
}

/** full card (or null) */
function bj_item(string $series, string $slug): ?array {
  if ($series === BJ_MYTH_SERIES) {
    $rows = bj_decode(bj_query('SELECT id, slug, claim, question, verdict, short, body, sources, images, DATE_FORMAT(published_at, "%Y-%m-%d") AS publishedAt
      FROM bj_myths WHERE slug = ? AND published_at <= ?', [$slug, bj_cutoff()]), ['body', 'sources', 'images']);
  } else {
    $rows = bj_decode(bj_query('SELECT slug, series_slug AS seriesSlug, kind AS format, title, hook, body, sources, images, image_credits AS imageCredits,
      topic, doodle, bg, read_minutes AS readMinutes, DATE_FORMAT(published_at, "%Y-%m-%d") AS publishedAt
      FROM bj_posts WHERE series_slug = ? AND slug = ? AND hidden = 0 AND published_at <= ?', [$series, $slug, bj_cutoff()]), ['body', 'sources', 'images', 'imageCredits']);
  }
  if (!$rows) return null;
  $rows[0]['locked'] = false;
  return $rows[0];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  if (isset($_GET['mystery'])) bj_out(['mystery' => bj_mystery(), 'multiplier' => BJ_POINTS_DAILY_MYSTERY]);
  $o = bj_unlock_owner(false);
  if (isset($_GET['progress'])) bj_out(['progress' => bj_progress($o)]);
  if (isset($_GET['left'])) {
    $out = [];
    foreach (array_slice(explode(',', (string)$_GET['left']), 0, 40) as $s) {
      if (preg_match('/^[a-z0-9-]{1,80}$/', $s)) $out[$s] = max(0, BJ_UNLOCKS_PER_DAY - bj_used_today($o, $s)) + (bj_bonus_key($o['user']) ? 1 : 0);
    }
    bj_out(['left' => $out, 'resetsAt' => bj_next_reset()]);
  }
  $series = bj_slug($_GET['series'] ?? '');
  if ($series === '') bj_fail('invalid');
  $state = bj_state($o, $series);
  $state['unlocked'] = bj_unlocked($o, $series);
  $state['free'] = bj_free_items($series);
  if ($o['user']) $state['total'] = bj_unlock_points($o['user']);
  bj_out($state);
}

$in = bj_post_json();
$action = $in['action'] ?? '';
$series = bj_slug($in['series'] ?? '');
$slug = is_string($in['item'] ?? null) && preg_match('/^[a-z0-9-]{1,100}$/', $in['item']) ? $in['item'] : '';
if ($series === '' || $slug === '' || !bj_series_ok($series)) bj_fail('invalid');

if ($action === 'share') {
  $me = bj_user();
  if (!$me) bj_out(['points' => 0]);
  bj_rate_limit('share', 20, 3600);
  $o = ['user' => (int)$me['id'], 'anon' => null];
  if (!in_array($slug, array_merge(bj_free_items($series), bj_unlocked($o, $series)), true)) bj_fail('locked', 403);
  $st = $db->prepare('INSERT IGNORE INTO bonus_points (user_id, kind, bonus_day, points) VALUES (?, ?, ?, ?)');
  $st->execute([$o['user'], 'share', bj_dhaka_day(), BJ_POINTS_SHARE]);
  bj_out(['points' => $st->rowCount() ? BJ_POINTS_SHARE : 0, 'total' => bj_unlock_points($o['user'])]);
}

if ($action !== 'unlock') bj_fail('action');
bj_rate_limit('unlock', 60, 3600);
$o = bj_unlock_owner(true);
$item = bj_item($series, $slug);
if (!$item) bj_fail('not_found', 404);

$free = in_array($slug, bj_free_items($series), true);
$already = in_array($slug, bj_unlocked($o, $series), true);
if ($free || $already) bj_out(['item' => $item, 'points' => 0, 'already' => true] + bj_state($o, $series));

$guess = in_array($in['guess'] ?? null, ['myth', 'true'], true) ? $in['guess'] : null;
$correct = ($series === BJ_MYTH_SERIES && $guess) ? ($guess === $item['verdict']) : null;
$mystery = bj_mystery();
$isMystery = $mystery && $mystery['seriesSlug'] === $series && $mystery['slug'] === $slug;

// the limit check and the insert run in one transaction so two quick taps cannot spend 3 keys
$db->beginTransaction();
[$w, $v] = bj_owner_where($o);
$st = $db->prepare("SELECT COUNT(*) FROM content_unlocks WHERE $w AND series_slug = ? AND unlock_day = ? FOR UPDATE");
$st->execute([$v, $series, bj_dhaka_day()]);
$useBonus = false;
$firstToday = !bj_unlocked_today_any($o['user']);
if ((int)$st->fetchColumn() >= BJ_UNLOCKS_PER_DAY) {
  if (bj_bonus_key($o['user'])) {
    $useBonus = true;
  } else {
    $db->rollBack();
    bj_out(['error' => 'no_keys'] + bj_state($o, $series), 429);
  }
}
$points = 0;
if ($o['user']) {
  $points = BJ_POINTS_UNLOCK + ($correct ? BJ_POINTS_GUESS_BONUS : 0);
  if ($isMystery) $points *= BJ_POINTS_DAILY_MYSTERY;
}
try {
  $cols = 'user_id, anon_key, series_slug, item_slug, guess, correct, points, unlock_day' . ($useBonus ? ', bonus' : '');
  $vals = [$o['user'], $o['anon'], $series, $slug, $guess, $correct === null ? null : (int)$correct, $points, bj_dhaka_day()];
  if ($useBonus) $vals[] = 1;
  $db->prepare("INSERT INTO content_unlocks ($cols) VALUES (" . implode(',', array_fill(0, count($vals), '?')) . ')')->execute($vals);
  $db->commit();
} catch (PDOException $e) {
  $db->rollBack();
  if ($e->getCode() !== '23000') throw $e;
  $points = 0; // opened in another tab a moment ago
}
$badges = [];
$progress = null;
if ($o['user'] && $points > 0) {
  $uid = $o['user'];
  // streak milestones (first unlock of the day)
  if ($firstToday) {
    $streak = bj_streak_before_today($uid) + 1;
    if (in_array($streak, BJ_STREAK_BONUS_DAYS, true)) {
      $badges = array_merge($badges, bj_profile_add_badges($uid, ["streak-$streak"]));
      bj_notify($uid, 'badge', "টানা {$streak} দিন কৌতূহলী! 🔥", 'আজ একটা বোনাস চাবি পেলে — যেকোনো সিরিজে খোলো।', '/me#badges', "streak-$streak-" . bj_dhaka_day());
    }
  }
  // series completion → collectible badge card
  $progress = bj_progress($o)[$series] ?? null;
  if ($progress && $progress['opened'] >= $progress['total']) {
    $new = bj_profile_add_badges($uid, ["series:$series"]);
    if ($new) {
      $badges = array_merge($badges, $new);
      bj_notify($uid, 'badge', 'সিরিজ শেষ! নতুন ব্যাজ কার্ড 🏅', 'পুরো সিরিজ খুলে ফেলেছ — কার্ডটা তোমার প্রোফাইলে।', '/me#badges', "series-$series");
    }
  }
}
$out = ['item' => $item, 'points' => $points, 'correct' => $correct, 'mystery' => $isMystery, 'bonusUsed' => $useBonus, 'newBadges' => $badges, 'progress' => $progress] + bj_state($o, $series);
if ($o['user']) $out['total'] = bj_unlock_points($o['user']);
bj_out($out);
