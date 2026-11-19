<?php
// Core-team admin API. Role 'core' only. GETs need the session; POSTs also need
// X-CSRF-Token, are rate-limited and every change is written to audit_log.
//
// GET ?list=stats | pitches | comments[&status=pending|approved|rejected|all] | inbox[&kind=]
//          | users[&q=] | quizzes | quiz&slug= | posts[&q=] | audit
// POST {action: ...}  see the switch below.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$db = bj_db();

function bj_iso(?string $t): ?string { return $t ? gmdate('c', strtotime($t)) : null; }

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
  $u = bj_user();
  if (!$u) bj_fail('login', 401);
  if ($u['role'] !== 'core') bj_fail('forbidden', 403);
  $list = $_GET['list'] ?? '';

  if ($list === 'stats') {
    $n = fn(string $sql) => (int)$db->query($sql)->fetchColumn();
    bj_out([
      'users' => $n('SELECT COUNT(*) FROM users'),
      'comments' => $n('SELECT COUNT(*) FROM comments'),
      'commentsPending' => $n("SELECT COUNT(*) FROM comments WHERE status = 'pending'"),
      'pitches' => $n('SELECT COUNT(*) FROM pitches'),
      'pitchesWaiting' => $n("SELECT COUNT(*) FROM pitches WHERE status IN ('sent','reviewing') AND hidden = 0"),
      'attempts' => $n('SELECT COUNT(*) FROM quiz_attempts'),
      'inbox' => $n('SELECT COUNT(*) FROM inbox'),
      'inboxUnread' => $n('SELECT COUNT(*) FROM inbox WHERE read_at IS NULL'),
      'unlocks' => $n('SELECT COUNT(*) FROM content_unlocks'),
      'unlocksToday' => $n("SELECT COUNT(*) FROM content_unlocks WHERE unlock_day = '" . (new DateTime('now', new DateTimeZone('Asia/Dhaka')))->format('Y-m-d') . "'"),
    ]);
  }
  if ($list === 'pitches') {
    $rows = $db->query('SELECT code, status, title, subject, nickname, payload, created_at, updated_at, feedback, mentor_name, history, hidden FROM pitches ORDER BY created_at DESC LIMIT 300')->fetchAll();
    bj_out(['pitches' => array_map(fn($r) => array_filter([
      'code' => $r['code'], 'status' => $r['status'], 'title' => $r['title'], 'subject' => $r['subject'], 'nickname' => $r['nickname'],
      'createdAt' => bj_iso($r['created_at']), 'updatedAt' => bj_iso($r['updated_at']),
      'feedback' => $r['feedback'], 'mentorName' => $r['mentor_name'], 'history' => json_decode($r['history'], true) ?: [],
      'payload' => json_decode($r['payload'], true), 'hidden' => (bool)$r['hidden'],
    ], fn($v) => $v !== null), $rows)]);
  }
  if ($list === 'comments') {
    $status = $_GET['status'] ?? 'pending';
    $where = in_array($status, ['pending', 'approved', 'rejected'], true) ? 'WHERE status = ?' : '';
    $st = $db->prepare("SELECT id, target_type, target_id, nickname, avatar, body, status, created_at FROM comments $where ORDER BY created_at DESC LIMIT 300");
    $st->execute($where ? [$status] : []);
    bj_out(['comments' => array_map(fn($r) => [
      'id' => (string)$r['id'], 'target' => ['type' => $r['target_type'], 'id' => $r['target_id']], 'nickname' => $r['nickname'],
      'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'body' => $r['body'], 'status' => $r['status'],
      'createdAt' => bj_iso($r['created_at']),
    ], $st->fetchAll())]);
  }
  if ($list === 'inbox') {
    $kind = $_GET['kind'] ?? '';
    $st = $db->prepare('SELECT id, kind, fields, status, read_at, created_at FROM inbox' . ($kind !== '' ? ' WHERE kind = ?' : '') . ' ORDER BY created_at DESC LIMIT 300');
    $st->execute($kind !== '' ? [$kind] : []);
    bj_out(['inbox' => array_map(fn($r) => [
      'id' => (string)$r['id'], 'kind' => $r['kind'], 'fields' => json_decode($r['fields'], true) ?: [], 'status' => $r['status'],
      'read' => $r['read_at'] !== null, 'createdAt' => bj_iso($r['created_at']),
    ], $st->fetchAll())]);
  }
  if ($list === 'users') {
    $q = bj_str($_GET['q'] ?? '', 100);
    $sql = 'SELECT id, email, username, role, disabled, profile, created_at, last_login FROM users';
    $args = [];
    if ($q !== '') {
      $sql .= " WHERE email LIKE ? OR username LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(profile, '$.nickname')) LIKE ?";
      $like = '%' . addcslashes($q, '%_\\') . '%';
      $args = [$like, $like, $like];
    }
    $st = $db->prepare($sql . ' ORDER BY created_at DESC LIMIT 100');
    $st->execute($args);
    bj_out(['users' => array_map(function ($r) {
      $p = json_decode((string)$r['profile'], true) ?: [];
      return ['id' => (int)$r['id'], 'email' => $r['email'], 'username' => $r['username'], 'nickname' => $p['nickname'] ?? null,
        'ageBand' => $p['ageBand'] ?? null, 'role' => $r['role'], 'disabled' => (bool)$r['disabled'],
        'createdAt' => bj_iso($r['created_at']), 'lastLogin' => bj_iso($r['last_login'])];
    }, $st->fetchAll())]);
  }
  if ($list === 'quizzes') {
    $rows = $db->query('SELECT q.slug, q.kind, q.title, q.published, (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_slug = q.slug) AS n FROM quizzes q ORDER BY q.created_at DESC, q.slug')->fetchAll();
    bj_out(['quizzes' => array_map(fn($r) => ['slug' => $r['slug'], 'kind' => $r['kind'], 'title' => $r['title'], 'published' => (bool)$r['published'], 'questions' => (int)$r['n']], $rows)]);
  }
  if ($list === 'quiz') {
    $slug = bj_slug($_GET['slug'] ?? '');
    $st = $db->prepare('SELECT slug, kind, title, blurb, opens_at, seconds_per_question, published FROM quizzes WHERE slug = ?');
    $st->execute([$slug]);
    $z = $st->fetch();
    if (!$z) bj_fail('not_found', 404);
    $st = $db->prepare('SELECT id, question, option_a, option_b, option_c, option_d, answer, fact, image, image_alt, credit FROM quiz_questions WHERE quiz_slug = ? ORDER BY position');
    $st->execute([$slug]);
    bj_out(['slug' => $z['slug'], 'kind' => $z['kind'], 'title' => $z['title'], 'blurb' => $z['blurb'], 'opensAt' => bj_iso($z['opens_at']),
      'secondsPerQuestion' => (int)$z['seconds_per_question'], 'published' => (bool)$z['published'],
      'questions' => array_map(fn($r) => ['id' => $r['id'], 'q' => $r['question'], 'options' => [$r['option_a'], $r['option_b'], $r['option_c'], $r['option_d']],
        'answer' => (int)$r['answer'], 'fact' => $r['fact'], 'image' => $r['image'], 'imageAlt' => $r['image_alt'], 'credit' => $r['credit']], $st->fetchAll())]);
  }
  if ($list === 'posts') {
    $q = bj_str($_GET['q'] ?? '', 100);
    $sql = 'SELECT series_slug, slug, title, published_at, hidden FROM bj_posts';
    $args = [];
    if ($q !== '') {
      $sql .= ' WHERE title LIKE ? OR slug LIKE ? OR series_slug LIKE ?';
      $like = '%' . addcslashes($q, '%_\\') . '%';
      $args = [$like, $like, $like];
    }
    $st = $db->prepare($sql . ' ORDER BY published_at DESC, id DESC LIMIT 100');
    $st->execute($args);
    bj_out(['posts' => array_map(fn($r) => ['series' => $r['series_slug'], 'slug' => $r['slug'], 'title' => $r['title'], 'publishedAt' => $r['published_at'], 'hidden' => (bool)$r['hidden']], $st->fetchAll())]);
  }
  if ($list === 'audit') {
    $rows = $db->query('SELECT admin_email, action, target, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100')->fetchAll();
    bj_out(['audit' => array_map(fn($r) => ['at' => bj_iso($r['created_at']), 'by' => $r['admin_email'], 'action' => $r['action'], 'target' => $r['target'], 'detail' => $r['detail'] ? json_decode($r['detail'], true) : null], $rows)]);
  }
  bj_fail('invalid');
}

$in = bj_post_json();
$admin = bj_require_admin();
bj_rate_limit('admin', 300, 600);
$action = is_string($in['action'] ?? null) ? $in['action'] : '';

/** audit + success response (ends the request) */
function bj_done(array $admin, string $action, string $target, ?array $detail = null): void {
  bj_audit($admin, $action, $target, $detail);
  bj_out(['ok' => true]);
}

if ($action === 'comment') {
  $status = $in['status'] ?? '';
  if (!in_array($status, ['approved', 'rejected', 'pending'], true)) bj_fail('invalid');
  $id = (int)($in['id'] ?? 0);
  $db->prepare('UPDATE comments SET status = ? WHERE id = ?')->execute([$status, $id]);
  bj_done($admin, $action, "comment:$id", ['status' => $status]);
}
if ($action === 'comment_delete') {
  $id = (int)($in['id'] ?? 0);
  $db->prepare('DELETE FROM comments WHERE id = ?')->execute([$id]);
  bj_done($admin, $action, "comment:$id");
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
  bj_done($admin, $action, "pitch:$code", ['status' => $status]);
}
if ($action === 'pitch_hidden') {
  $code = bj_str($in['code'] ?? '', 16);
  $db->prepare('UPDATE pitches SET hidden = ? WHERE code = ?')->execute([!empty($in['hidden']) ? 1 : 0, $code]);
  bj_done($admin, $action, "pitch:$code", ['hidden' => !empty($in['hidden'])]);
}
if ($action === 'pitch_delete') {
  $code = bj_str($in['code'] ?? '', 16);
  $db->prepare('DELETE FROM pitches WHERE code = ?')->execute([$code]);
  bj_done($admin, $action, "pitch:$code");
}
if ($action === 'inbox') {
  $status = $in['status'] ?? '';
  if (!in_array($status, ['new', 'used', 'answered', 'archived'], true)) bj_fail('invalid');
  $id = (int)($in['id'] ?? 0);
  $db->prepare('UPDATE inbox SET status = ?, read_at = COALESCE(read_at, NOW()) WHERE id = ?')->execute([$status, $id]);
  bj_done($admin, $action, "inbox:$id", ['status' => $status]);
}
if ($action === 'inbox_read') {
  $id = (int)($in['id'] ?? 0);
  $db->prepare(!empty($in['read']) ? 'UPDATE inbox SET read_at = COALESCE(read_at, NOW()) WHERE id = ?' : 'UPDATE inbox SET read_at = NULL WHERE id = ?')->execute([$id]);
  bj_done($admin, $action, "inbox:$id", ['read' => !empty($in['read'])]);
}
if ($action === 'user_disabled') {
  $id = (int)($in['id'] ?? 0);
  if ($id === (int)$admin['id']) bj_fail('self');
  $db->prepare('UPDATE users SET disabled = ? WHERE id = ?')->execute([!empty($in['disabled']) ? 1 : 0, $id]);
  bj_done($admin, $action, "user:$id", ['disabled' => !empty($in['disabled'])]);
}
if ($action === 'user_role') {
  $id = (int)($in['id'] ?? 0);
  $role = ($in['role'] ?? '') === 'core' ? 'core' : 'member';
  if ($id === (int)$admin['id'] && $role !== 'core') bj_fail('self');
  $db->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $id]);
  bj_done($admin, $action, "user:$id", ['role' => $role]);
}
if ($action === 'quiz_publish') {
  $slug = bj_slug($in['slug'] ?? '');
  $db->prepare('UPDATE quizzes SET published = ? WHERE slug = ?')->execute([!empty($in['published']) ? 1 : 0, $slug]);
  bj_done($admin, $action, "quiz:$slug", ['published' => !empty($in['published'])]);
}
if ($action === 'quiz_save') {
  $z = is_array($in['quiz'] ?? null) ? $in['quiz'] : [];
  $slug = bj_slug($z['slug'] ?? '');
  $title = bj_str($z['title'] ?? '', 200);
  $kind = in_array($z['kind'] ?? '', ['weekly', 'episode', 'initiator', 'pool', 'secret', 'season'], true) ? $z['kind'] : 'season';
  $qs = is_array($z['questions'] ?? null) ? array_slice(array_values($z['questions']), 0, 60) : [];
  if ($slug === '' || $title === '' || !$qs) bj_fail('invalid');
  $rows = [];
  foreach ($qs as $i => $q) {
    if (!is_array($q)) bj_fail('question_' . ($i + 1));
    $opts = is_array($q['options'] ?? null) ? array_values($q['options']) : [];
    $o = array_map(fn($x) => bj_str($x, 200), array_pad(array_slice($opts, 0, 4), 4, ''));
    $text = bj_str($q['q'] ?? '', 500);
    $ans = (int)($q['answer'] ?? -1);
    if ($text === '' || in_array('', $o, true) || $ans < 0 || $ans > 3) bj_fail('question_' . ($i + 1));
    $img = bj_str($q['image'] ?? '', 255);
    if ($img !== '' && !preg_match('#^/media/[\w./-]+\.(webp|jpg|jpeg|png)$#', $img)) bj_fail('image_' . ($i + 1));
    $rows[] = [$slug . '-' . ($i + 1), $slug, $i, $text, $o[0], $o[1], $o[2], $o[3], $ans, bj_str($q['fact'] ?? '', 2000),
      $img ?: null, bj_str($q['imageAlt'] ?? '', 300) ?: null, bj_str($q['credit'] ?? '', 300) ?: null];
  }
  $secs = max(5, min(120, (int)($z['secondsPerQuestion'] ?? 20)));
  $opens = !empty($z['opensAt']) && strtotime((string)$z['opensAt']) ? gmdate('Y-m-d H:i:s', strtotime((string)$z['opensAt'])) : null;
  $db->beginTransaction();
  $db->prepare('INSERT INTO quizzes (slug, kind, title, blurb, opens_at, seconds_per_question, published) VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE kind = VALUES(kind), title = VALUES(title), blurb = VALUES(blurb), opens_at = VALUES(opens_at),
    seconds_per_question = VALUES(seconds_per_question), published = VALUES(published)')
    ->execute([$slug, $kind, $title, bj_str($z['blurb'] ?? '', 500), $opens, $secs, !empty($z['published']) ? 1 : 0]);
  $db->prepare('DELETE FROM quiz_questions WHERE quiz_slug = ?')->execute([$slug]);
  $ins = $db->prepare('INSERT INTO quiz_questions (id, quiz_slug, position, question, option_a, option_b, option_c, option_d, answer, fact, image, image_alt, credit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  foreach ($rows as $r) $ins->execute($r);
  $db->commit();
  bj_done($admin, $action, "quiz:$slug", ['questions' => count($rows)]);
}
if ($action === 'post_hidden') {
  $series = bj_slug($in['series'] ?? '');
  $slug = bj_str($in['slug'] ?? '', 100);
  $db->prepare('UPDATE bj_posts SET hidden = ? WHERE series_slug = ? AND slug = ?')->execute([!empty($in['hidden']) ? 1 : 0, $series, $slug]);
  bj_done($admin, $action, "post:$series/$slug", ['hidden' => !empty($in['hidden'])]);
}
bj_fail('action');
