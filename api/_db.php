<?php
// Shared PDO helper. Credentials live OUTSIDE public_html in bhabajay-deploy/db.env
// (DB_DATABASE, DB_USERNAME, DB_PASSWORD, optional DB_HOST). Never commit them.
declare(strict_types=1);

if (!function_exists('bj_db')) {
  function bj_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $candidates = array_filter([
      getenv('BJ_DB_ENV') ?: null,
      dirname(__DIR__, 2) . '/bhabajay-deploy/db.env',
      dirname(__DIR__, 3) . '/bhabajay-deploy/db.env',
      dirname(__DIR__, 4) . '/bhabajay-deploy/db.env',
      '/home/u239665931/bhabajay-deploy/db.env',
    ]);
    $env = null;
    foreach ($candidates as $f) {
      if (is_readable($f)) { $env = parse_ini_file($f, false, INI_SCANNER_RAW); break; }
    }
    if (!$env || empty($env['DB_DATABASE']) || empty($env['DB_USERNAME'])) {
      throw new RuntimeException('db config missing');
    }
    $host = $env['DB_HOST'] ?? 'localhost';
    $pdo = new PDO("mysql:host={$host};dbname={$env['DB_DATABASE']};charset=utf8mb4", $env['DB_USERNAME'], $env['DB_PASSWORD'] ?? '', [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
  }
}
