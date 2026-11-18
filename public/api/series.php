<?php
/**
 * GET /api/series.php             -> all series with post counts (published up to today)
 * GET /api/series.php?slug=<slug> -> one series
 */
declare(strict_types=1);
require __DIR__ . '/_content.php';

bj_run(function () {
    $slug = bj_param('slug');
    $today = bj_cutoff();
    $sql = 'SELECT s.slug, s.title, s.tagline, s.subject, s.topic, s.doodle, s.color, s.description, s.cover,
                   DATE_FORMAT(s.launched_at, "%Y-%m-%d") AS launchedAt,
                   (SELECT COUNT(*) FROM bj_posts p WHERE p.series_slug = s.slug AND p.published_at <= ?) AS posts,
                   (SELECT DATE_FORMAT(MAX(p.published_at), "%Y-%m-%d") FROM bj_posts p WHERE p.series_slug = s.slug AND p.published_at <= ?) AS latest
            FROM bj_series s';
    if ($slug) {
        $rows = bj_decode(bj_query("$sql WHERE s.slug = ?", [$today, $today, $slug]), ['color']);
        if (!$rows) bj_json(['error' => 'not found'], 60, 404);
        bj_json($rows[0], 600);
    }
    bj_json(bj_decode(bj_query("$sql ORDER BY latest DESC, s.launched_at DESC", [$today, $today]), ['color']), 600);
});
