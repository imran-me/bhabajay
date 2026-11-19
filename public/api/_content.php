<?php
/**
 * Read-only helpers for the public content endpoints (posts, series, myths).
 * Uses the shared connection from _db.php. Responses are cacheable JSON.
 *   $rows = bj_query('SELECT ... WHERE x = ?', [$x]);
 *   bj_json($rows, 300);
 */
declare(strict_types=1);
require_once __DIR__ . '/_db.php';

ini_set('display_errors', '0');

function bj_query(string $sql, array $params = []): array
{
    $st = bj_db()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

/** Decode JSON columns in place. */
function bj_decode(array $rows, array $cols): array
{
    foreach ($rows as &$r) {
        foreach ($cols as $c) {
            if (isset($r[$c]) && is_string($r[$c])) $r[$c] = json_decode($r[$c], true);
        }
    }
    return $rows;
}

function bj_json($data, int $maxAge = 300, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    // personalised responses (daily unlocks) must never be cached by proxies
    header($status === 200 && empty($GLOBALS['bj_private'])
        ? "Cache-Control: public, max-age=$maxAge, stale-while-revalidate=86400"
        : ($status === 200 ? 'Cache-Control: private, no-store' : 'Cache-Control: no-store'));
    if (!empty($GLOBALS['bj_private'])) header('Vary: Cookie');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** GET only; any failure returns a generic error, details go to the server log. */
function bj_run(callable $fn): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        header('Allow: GET');
        bj_json(['error' => 'method not allowed'], 0, 405);
    }
    try {
        $fn();
    } catch (Throwable $t) {
        error_log('[bj-api] ' . $t->getMessage());
        bj_json(['error' => 'unavailable'], 0, 503);
    }
}

function bj_param(string $name, string $pattern = '/^[a-z0-9-]{1,100}$/'): ?string
{
    $v = $_GET[$name] ?? null;
    if ($v === null || $v === '') return null;
    if (!is_string($v) || !preg_match($pattern, $v)) bj_json(['error' => "bad $name"], 0, 400);
    return $v;
}

/**
 * Last publish date visible on the site. The website is the full library, so by
 * default every imported post shows regardless of its Facebook schedule.
 * Set BJ_SCHEDULE=1 in db.env-adjacent server env to hide future posts again.
 */
function bj_cutoff(): string
{
    if (getenv('BJ_SCHEDULE') === '1') {
        return (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d');
    }
    return '9999-12-31';
}
