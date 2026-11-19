<?php
// GET /api/quiz.php?slug=bhabu-quiz-s1  → one quiz with questions
// GET /api/quiz.php                      → list of quizzes (no questions)
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$db = bj_db();
$slug = bj_slug($_GET['slug'] ?? '');
if ($slug === '') {
  $rows = $db->query('SELECT slug, kind, title, blurb, opens_at AS opensAt, seconds_per_question AS secondsPerQuestion FROM quizzes WHERE published = 1 ORDER BY created_at, slug')->fetchAll();
  bj_out(['quizzes' => $rows]);
}
$st = $db->prepare('SELECT slug, kind, title, blurb, opens_at AS opensAt, seconds_per_question AS secondsPerQuestion FROM quizzes WHERE slug = ? AND published = 1');
$st->execute([$slug]);
$quiz = $st->fetch();
if (!$quiz) bj_fail('not_found', 404);
$st = $db->prepare('SELECT id, question, option_a, option_b, option_c, option_d, answer, fact, image, image_alt, credit FROM quiz_questions WHERE quiz_slug = ? ORDER BY position');
$st->execute([$slug]);
$quiz['questions'] = array_map(fn($r) => array_filter([
  'id' => $r['id'], 'q' => $r['question'],
  'options' => [$r['option_a'], $r['option_b'], $r['option_c'], $r['option_d']],
  'answer' => (int)$r['answer'], 'fact' => $r['fact'],
  'image' => $r['image'], 'imageAlt' => $r['image_alt'], 'credit' => $r['credit'],
], fn($v) => $v !== null), $st->fetchAll());
$quiz['secondsPerQuestion'] = (int)$quiz['secondsPerQuestion'];
header('Cache-Control: public, max-age=300');
bj_out($quiz);
