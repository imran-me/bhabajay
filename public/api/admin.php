<?php
// Core-team moderation (role = 'core' only; signed in + X-CSRF-Token on POST).
// GET  /api/admin.php?list=pitches|comments|inbox[&kind=..]
// POST {action:'comment', id, status:'approved'|'rejected'}
// POST {action:'pitch', code, status, feedback?, mentorName?}
// POST {action:'pitch_hidden', code, hidden:true|false}
// POST {action:'inbox', id, status}
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  $u = bj_user();
  if (!$u) bj_fail('login', 401);
  if ($u['role'] !== 'core') bj_fail('forbidden', 403);
  $list = $_GET['list'] ?? '';
  if ($list === 'pitches') {
    $rows = $db->query('SELECT code, status, title, subject, nickname, payload, created_at, updated_at, feedback, mentor_name, history, hidden FROM pitches ORDER BY created_at DESC LIMIT 300')->fetchAll();
    bj_out(['pitches' => array_map(fn($r) => array_filter([
      'code' => $r['code'], 'status' => $r['status'], 'title' => $r['title'], 'subject' => $r['subject'], 'nickname' => $r['nickname'],
      'createdAt' => gmdate('c', strtotime($r['created_at'])), 'updatedAt' => gmdate('c', strtotime($r['updated_at'])),
      'feedback' => $r['feedback'], 'mentorName' => $r['mentor_name'], 'history' => json_decode($r['history'], true) ?: [],
      'payload' => json_decode($r['payload'], true), 'hidden' => (bool)$r['hidden'],
    ], fn($v) => $v !== null), $rows)]);
  }
  if ($list === 'comments') {
    $rows = $db->query("SELECT id, target_type, target_id, nickname, avatar, body, status, created_at FROM comments WHERE status = 'pending' ORDER BY created_at LIMIT 300")->fetchAll();
    bj_out(['comments' => array_map(fn($r) => [
      'id' => (string)$r['id'], 'target' => ['type' => $r['target_type'], 'id' => $r['target_id']], 'nickname' => $r['nickname'],
      'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'body' => $r['body'], 'status' => $r['status'],
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
    ], $rows)]);
  }
  if ($list === 'inbox') {
    $kind = $_GET['kind'] ?? '';
    $sql = 'SELECT id, kind, fields, status, created_at FROM inbox' . ($kind !== '' ? ' WHERE kind = ?' : '') . ' ORDER BY created_at DESC LIMIT 300';
    $st = $db->prepare($sql);
    $st->execute($kind !== '' ? [$kind] : []);
    bj_out(['inbox' => array_map(fn($r) => [
      'id' => (string)$r['id'], 'kind' => $r['kind'], 'fields' => json_decode($r['fields'], true) ?: [], 'status' => $r['status'],
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
    ], $st->fetchAll())]);
  }
  bj_fail('invalid');
}

$in = bj_post_json();
bj_require_admin();
$action = $in['action'] ?? '';

if ($action === 'comment') {
  $status = $in['status'] ?? '';
  if (!in_array($status, ['approved', 'rejected', 'pending'], true)) bj_fail('invalid');
  $db->prepare('UPDATE comments SET status = ? WHERE id = ?')->execute([$status, (int)($in['id'] ?? 0)]);
  bj_out(['ok' => true]);
}

if ($action === 'pitch') {
  $status = $in['status'] ?? '';
  if (!in_array($status, ['sent', 'reviewing', 'mentor', 'live', 'not_yet'], true)) bj_fail('invalid');
  $code = bj_str($in['code'] ?? '', 16);
  $st = $db->prepare('SELECT history FROM pitches WHERE code = ?');
  $st->execute([$code]);
  $h = $st->fetchColumn();
  if ($h === false) bj_fail('not_found', 404);
  $history = json_decode((string)$h, true) ?: [];
  $feedback = array_key_exists('feedback', $in) ? (bj_str($in['feedback'], 2000) ?: null) : null;
  $history[] = array_filter(['status' => $status, 'at' => gmdate('c'), 'note' => $feedback], fn($v) => $v !== null);
  $db->prepare('UPDATE pitches SET status = ?, history = ?, feedback = COALESCE(?, feedback), mentor_name = COALESCE(?, mentor_name) WHERE code = ?')
    ->execute([$status, json_encode($history, JSON_UNESCAPED_UNICODE), $feedback, bj_str($in['mentorName'] ?? '', 100) ?: null, $code]);
  bj_out(['ok' => true]);
}

if ($action === 'pitch_hidden') {
  $db->prepare('UPDATE pitches SET hidden = ? WHERE code = ?')->execute([!empty($in['hidden']) ? 1 : 0, bj_str($in['code'] ?? '', 16)]);
  bj_out(['ok' => true]);
}

if ($action === 'inbox') {
  $status = $in['status'] ?? '';
  if (!in_array($status, ['new', 'used', 'answered', 'archived'], true)) bj_fail('invalid');
  $db->prepare('UPDATE inbox SET status = ? WHERE id = ?')->execute([$status, (int)($in['id'] ?? 0)]);
  bj_out(['ok' => true]);
}

bj_fail('action');
