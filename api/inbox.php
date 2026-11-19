<?php
// POST /api/inbox.php {kind, fields:{...}} — myth tips, questions, mentor offers, contact messages
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$in = bj_post_json();
bj_rate_limit('inbox', 10, 3600);
$kind = $in['kind'] ?? '';
if (!in_array($kind, ['myth_tip', 'question', 'mentor', 'contact'], true)) bj_fail('invalid');
$fields = [];
foreach ((is_array($in['fields'] ?? null) ? $in['fields'] : []) as $k => $v) {
  if (count($fields) >= 20 || !preg_match('/^\w{1,40}$/', (string)$k)) continue;
  $fields[$k] = bj_str(is_scalar($v) ? (string)$v : '', 4000);
}
if (!array_filter($fields)) bj_fail('invalid');
bj_db()->prepare('INSERT INTO inbox (kind, fields, ip_hash) VALUES (?,?,?)')
  ->execute([$kind, json_encode($fields, JSON_UNESCAPED_UNICODE), bj_ip_hash()]);
bj_out(['ok' => true], 201);
