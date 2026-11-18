<?php
// GET /api/health.php → {"ok":true} when PHP + MySQL (with the schema) are reachable,
// {"ok":false} otherwise (always HTTP 200, so browsers log no error). The site uses
// this to choose the server backend; anything but ok:true means browser demo mode.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
try {
  bj_db()->query('SELECT 1 FROM comments LIMIT 1');
  bj_out(['ok' => true]);
} catch (Throwable $e) {
  error_log('[bj-api] health: ' . $e->getMessage());
  bj_out(['ok' => false]);
}
