<?php
// GET /api/health.php → {"ok":true} when PHP + MySQL are reachable. The site uses
// this to choose the server backend; anything else means browser demo mode.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
bj_db()->query('SELECT 1 FROM comments LIMIT 1');
bj_out(['ok' => true]);
