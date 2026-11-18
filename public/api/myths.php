<?php
/**
 * GET /api/myths.php            -> published myth cards (মিথ না সত্যি), newest first
 * GET /api/myths.php?slug=<s>   -> one myth
 */
declare(strict_types=1);
require __DIR__ . '/_content.php';

bj_run(function () {
    $slug = bj_param('slug');
    $today = (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
    $cols = 'id, slug, claim, question, verdict, short, body, sources, images, DATE_FORMAT(published_at, "%Y-%m-%d") AS publishedAt';
    $json = ['body', 'sources', 'images'];
    if ($slug) {
        $rows = bj_decode(bj_query("SELECT $cols FROM bj_myths WHERE slug = ? AND published_at <= ?", [$slug, $today]), $json);
        if (!$rows) bj_json(['error' => 'not found'], 60, 404);
        bj_json($rows[0], 600);
    }
    bj_json(bj_decode(bj_query("SELECT $cols FROM bj_myths WHERE published_at <= ? ORDER BY published_at DESC LIMIT 100", [$today]), $json), 300);
});
