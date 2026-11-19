<?php
// Daily unlocks ("ভাবুর চাবি"): per series, each visitor may open UNLOCKS_PER_DAY locked
// cards per Asia/Dhaka day. The first FREE_PER_SERIES cards of every series (oldest
// first) are always open. Signed-in users earn points; signed-out visitors unlock
// through their session cookie (no points). Everything is decided here, never by the client.
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

const BJ_UNLOCKS_PER_DAY = 2;
const BJ_FREE_PER_SERIES = 2;
const BJ_POINTS_UNLOCK = 10;
const BJ_POINTS_GUESS_BONUS = 5;
const BJ_POINTS_DAILY_MYSTERY = 2;   // multiplier for "আজকের রহস্য"
const BJ_POINTS_SHARE = 5;           // once per Dhaka day
const BJ_MYTH_SERIES = 'myth-na-sotti';

/** true when a query failed only because the DB sync has not created a table/column yet */
function bj_missing_schema(Throwable $e): bool {
  return $e instanceof PDOException && in_array((string)$e->getCode(), ['42S02', '42S22'], true);
}

function bj_dhaka_now(): DateTime { return new DateTime('now', new DateTimeZone('Asia/Dhaka')); }
function bj_dhaka_day(): string { return bj_dhaka_now()->format('Y-m-d'); }
function bj_next_reset(): string {
  $d = bj_dhaka_now();
  $d->setTime(0, 0)->modify('+1 day');
  return $d->format(DATE_ATOM);
}

/** ['user' => int|null, 'anon' => string|null]; $start = create an anonymous session if needed. */
function bj_unlock_owner(bool $start): array {
  $u = bj_user();
  if ($u) return ['user' => (int)$u['id'], 'anon' => null];
  if (!$start && empty($_COOKIE['BJSESS'])) return ['user' => null, 'anon' => null];
  bj_session();
  return ['user' => null, 'anon' => hash('sha256', 'anon|' . session_id())];
}

function bj_owner_where(array $o): array {
  return $o['user'] ? ['user_id = ?', $o['user']] : ['anon_key = ?', $o['anon']];
}

/** item slugs this owner has unlocked in a series */
function bj_unlocked(array $o, string $series): array {
  if (!$o['user'] && !$o['anon']) return [];
  [$w, $v] = bj_owner_where($o);
  try {
    $st = bj_db()->prepare("SELECT item_slug FROM content_unlocks WHERE $w AND series_slug = ?");
    $st->execute([$v, $series]);
    return $st->fetchAll(PDO::FETCH_COLUMN);
  } catch (PDOException $e) {
    if (bj_missing_schema($e)) return [];
    throw $e;
  }
}

/** how many unlocks this owner used today in a series */
function bj_used_today(array $o, string $series): int {
  if (!$o['user'] && !$o['anon']) return 0;
  [$w, $v] = bj_owner_where($o);
  try {
    $st = bj_db()->prepare("SELECT COUNT(*) FROM content_unlocks WHERE $w AND series_slug = ? AND unlock_day = ?");
    $st->execute([$v, $series, bj_dhaka_day()]);
    return (int)$st->fetchColumn();
  } catch (PDOException $e) {
    if (bj_missing_schema($e)) return 0;
    throw $e;
  }
}

/** the always-open cards of a series (oldest first) */
function bj_free_items(string $series): array {
  static $cache = [];
  if (isset($cache[$series])) return $cache[$series];
  $sql = $series === BJ_MYTH_SERIES
    ? 'SELECT slug FROM bj_myths ORDER BY published_at ASC, id ASC LIMIT ' . BJ_FREE_PER_SERIES
    : 'SELECT slug FROM bj_posts WHERE series_slug = ? AND hidden = 0 ORDER BY published_at ASC, id ASC LIMIT ' . BJ_FREE_PER_SERIES;
  try {
    $st = bj_db()->prepare($sql);
    $st->execute($series === BJ_MYTH_SERIES ? [] : [$series]);
  } catch (PDOException $e) {
    if (!bj_missing_schema($e)) throw $e;
    $st = bj_db()->prepare(str_replace(' AND hidden = 0', '', $sql)); // before the hidden column exists
    $st->execute($series === BJ_MYTH_SERIES ? [] : [$series]);
  }
  return $cache[$series] = $st->fetchAll(PDO::FETCH_COLUMN);
}

/**
 * Strip the content of cards this visitor has not opened. $kind = 'post' | 'myth'.
 * Rows keep enough to draw a locked card (title / claim, cover for posts).
 */
function bj_apply_locks(array $rows, string $kind): array {
  $o = bj_unlock_owner(false);
  $open = [];
  foreach ($rows as &$r) {
    $series = $kind === 'myth' ? BJ_MYTH_SERIES : $r['seriesSlug'];
    $open[$series] ??= array_flip(array_merge(bj_free_items($series), bj_unlocked($o, $series)));
    if (isset($open[$series][$r['slug']])) { $r['locked'] = false; continue; }
    $r['locked'] = true;
    if ($kind === 'myth') {
      $r = ['slug' => $r['slug'], 'claim' => $r['claim'], 'question' => $r['question'], 'publishedAt' => $r['publishedAt'], 'locked' => true];
    } else {
      $cover = is_array($r['images'] ?? null) ? array_slice($r['images'], 0, 1) : [];
      $r = ['slug' => $r['slug'], 'seriesSlug' => $r['seriesSlug'], 'title' => $r['title'], 'hook' => '', 'body' => [], 'sources' => [],
        'images' => $cover, 'readMinutes' => $r['readMinutes'] ?? 1, 'publishedAt' => $r['publishedAt'], 'locked' => true];
    }
  }
  unset($r);
  $GLOBALS['bj_private'] = true; // personalised: never cache publicly
  return $rows;
}

/** per-series progress for this visitor: [slug => [opened, total]] */
function bj_progress(array $o): array {
  $db = bj_db();
  $tot = [];
  foreach ($db->query('SELECT series_slug, COUNT(*) AS n FROM bj_posts WHERE hidden = 0 GROUP BY series_slug')->fetchAll() as $r) $tot[$r['series_slug']] = (int)$r['n'];
  $tot[BJ_MYTH_SERIES] = (int)$db->query('SELECT COUNT(*) FROM bj_myths')->fetchColumn();
  $un = [];
  if ($o['user'] || $o['anon']) {
    [$w, $v] = bj_owner_where($o);
    $st = $db->prepare("SELECT series_slug, COUNT(*) AS n FROM content_unlocks WHERE $w GROUP BY series_slug");
    $st->execute([$v]);
    foreach ($st->fetchAll() as $r) $un[$r['series_slug']] = (int)$r['n'];
  }
  $out = [];
  foreach ($tot as $slug => $n) $out[$slug] = ['opened' => min($n, min(BJ_FREE_PER_SERIES, $n) + ($un[$slug] ?? 0)), 'total' => $n];
  return $out;
}

