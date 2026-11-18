<?php
// POST /api/pitches.php  PitchPayload JSON  → {code}
// GET  /api/pitches.php?code=BJ-P-0001      → public status (no personal data)
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  $p = bj_post_json();
  bj_rate_limit('pitch', 5, 3600);
  $title = bj_str($p['workingTitle'] ?? '', 200);
  $subject = bj_str($p['subject'] ?? '', 300);
  $nick = bj_str($p['nickname'] ?? '', 40);
  $email = bj_str($p['contactEmail'] ?? '', 200);
  if ($title === '' || $subject === '' || $nick === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) bj_fail('invalid');
  if (!in_array($p['ageBand'] ?? '', ['13-17', '18+'], true)) bj_fail('invalid');
  if (($p['ageBand'] === '13-17') && !filter_var(bj_str($p['parentEmail'] ?? '', 200), FILTER_VALIDATE_EMAIL)) bj_fail('parent');
  $payload = json_encode($p, JSON_UNESCAPED_UNICODE);
  if (strlen($payload) > 30000) bj_fail('too_long');
  $now = gmdate('c');
  for ($try = 0; $try < 5; $try++) {
    $code = 'BJ-P-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
    try {
      $db->prepare('INSERT INTO pitches (code, title, subject, nickname, contact_email, payload, history, ip_hash) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$code, $title, $subject, $nick, $email, $payload, json_encode([['status' => 'sent', 'at' => $now]]), bj_ip_hash()]);
      bj_out(['code' => $code], 201);
    } catch (PDOException $e) {
      if ($e->getCode() !== '23000') throw $e;
    }
  }
  bj_fail('server', 500);
}

$code = strtoupper(bj_str($_GET['code'] ?? '', 16));
if (!preg_match('/^BJ-P-[0-9A-F]{4,5}$/', $code)) bj_fail('invalid');
bj_rate_limit('pitch-read', 60, 600);
$st = $db->prepare('SELECT code, status, title, created_at, updated_at, feedback, mentor_name, history FROM pitches WHERE code = ?');
$st->execute([$code]);
$r = $st->fetch();
if (!$r) bj_out(null, 404);
bj_out(array_filter([
  'code' => $r['code'], 'status' => $r['status'], 'title' => $r['title'],
  'createdAt' => gmdate('c', strtotime($r['created_at'])), 'updatedAt' => gmdate('c', strtotime($r['updated_at'])),
  'feedback' => $r['feedback'], 'mentorName' => $r['mentor_name'], 'history' => json_decode($r['history'], true) ?: [],
], fn($v) => $v !== null));
