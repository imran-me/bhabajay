<?php
/**
 * GET /api/posts.php?series=<slug>[&limit=24&offset=0]  -> list (published up to today, Dhaka time)
 * GET /api/posts.php?series=<slug>&slug=<post>           -> one post
 * GET /api/posts.php?limit=12                            -> latest across series
 */
declare(strict_types=1);
require __DIR__ . '/_content.php';

bj_run(function () {
    $series = bj_param('series');
    $slug = bj_param('slug');
    $limit = max(1, min(60, (int)($_GET['limit'] ?? 24)));
    $offset = max(0, min(5000, (int)($_GET['offset'] ?? 0)));
    $today = (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
    $cols = 'slug, series_slug AS seriesSlug, kind AS format, title, hook, body, sources, images, image_credits AS imageCredits,
             topic, doodle, bg, read_minutes AS readMinutes, DATE_FORMAT(published_at, "%Y-%m-%d") AS publishedAt';
    $json = ['body', 'sources', 'images', 'imageCredits'];

    if ($series && $slug) {
        $rows = bj_decode(bj_query("SELECT $cols FROM bj_posts WHERE series_slug = ? AND slug = ? AND published_at <= ?", [$series, $slug, $today]), $json);
        if (!$rows) bj_json(['error' => 'not found'], 60, 404);
        bj_json($rows[0], 600);
    }
    if ($series) {
        $rows = bj_query("SELECT $cols FROM bj_posts WHERE series_slug = ? AND published_at <= ? ORDER BY published_at DESC, id DESC LIMIT $limit OFFSET $offset", [$series, $today]);
        $total = (int)(bj_query('SELECT COUNT(*) AS n FROM bj_posts WHERE series_slug = ? AND published_at <= ?', [$series, $today])[0]['n'] ?? 0);
    } else {
        $rows = bj_query("SELECT $cols FROM bj_posts WHERE published_at <= ? ORDER BY published_at DESC, id DESC LIMIT $limit OFFSET $offset", [$today]);
        $total = (int)(bj_query('SELECT COUNT(*) AS n FROM bj_posts WHERE published_at <= ?', [$today])[0]['n'] ?? 0);
    }
    bj_json(['total' => $total, 'items' => bj_decode($rows, $json)], 300);
});
