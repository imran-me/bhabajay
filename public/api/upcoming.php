<?php
/**
 * Teaser data for posts that are scheduled but not yet published.
 * Reveals only the date and the first card image (shown blurred), never the text.
 * GET /api/upcoming.php                -> next post per series + next myth
 * GET /api/upcoming.php?series=<slug>  -> next post of one series ('myth-na-sotti' = myths)
 */
declare(strict_types=1);
require __DIR__ . '/_content.php';

bj_run(function () {
    $series = bj_param('series');
    $today = (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
    $first = function (?string $json): ?array {
        $imgs = $json ? json_decode($json, true) : null;
        if (!is_array($imgs) || !$imgs) return null;
        $i = $imgs[0];
        return ['src' => $i['src'] ?? null, 'width' => $i['width'] ?? null, 'height' => $i['height'] ?? null];
    };
    $count = fn(string $sql, array $p) => (int)(bj_query($sql, $p)[0]['n'] ?? 0);

    $nextMyth = function () use ($today, $first, $count) {
        $r = bj_query('SELECT DATE_FORMAT(published_at, "%Y-%m-%d") AS d, images FROM bj_myths WHERE published_at > ? ORDER BY published_at ASC LIMIT 1', [$today]);
        if (!$r) return null;
        return ['series' => 'myth-na-sotti', 'nextDate' => $r[0]['d'], 'preview' => $first($r[0]['images']),
                'upcoming' => $count('SELECT COUNT(*) AS n FROM bj_myths WHERE published_at > ?', [$today])];
    };
    $nextPost = function (string $slug) use ($today, $first, $count) {
        $r = bj_query('SELECT DATE_FORMAT(published_at, "%Y-%m-%d") AS d, images FROM bj_posts WHERE series_slug = ? AND published_at > ? ORDER BY published_at ASC, id ASC LIMIT 1', [$slug, $today]);
        if (!$r) return null;
        return ['series' => $slug, 'nextDate' => $r[0]['d'], 'preview' => $first($r[0]['images']),
                'upcoming' => $count('SELECT COUNT(*) AS n FROM bj_posts WHERE series_slug = ? AND published_at > ?', [$slug, $today])];
    };

    if ($series === 'myth-na-sotti') bj_json($nextMyth() ?? ['series' => $series, 'nextDate' => null], 900);
    if ($series) bj_json($nextPost($series) ?? ['series' => $series, 'nextDate' => null], 900);

    $out = [];
    foreach (bj_query('SELECT series_slug AS s, MIN(published_at) AS d FROM bj_posts WHERE published_at > ? GROUP BY series_slug ORDER BY d ASC', [$today]) as $row) {
        $n = $nextPost($row['s']);
        if ($n) $out[] = $n;
    }
    $m = $nextMyth();
    if ($m) $out[] = $m;
    bj_json($out, 900);
});
