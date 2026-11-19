<?php
// In-site notifications (no email). Tolerates the table not existing yet.
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

/** add a notification; $dedupe makes it once-only per user (e.g. "keys-2026-11-20") */
function bj_notify(int $uid, string $kind, string $title, string $body = '', ?string $href = null, ?string $dedupe = null): void {
  try {
    bj_db()->prepare('INSERT IGNORE INTO notifications (user_id, kind, title, body, href, dedupe) VALUES (?,?,?,?,?,?)')
      ->execute([$uid, $kind, mb_substr($title, 0, 200), mb_substr($body, 0, 500), $href, $dedupe]);
  } catch (PDOException $e) {
    if (!in_array((string)$e->getCode(), ['42S02', '42S22'], true)) error_log('[bj-api] notify: ' . $e->getMessage());
  }
}

/** add badge ids to the account's profile (server-awarded badges survive client syncs) */
function bj_profile_add_badges(int $uid, array $ids): array {
  $db = bj_db();
  $st = $db->prepare('SELECT profile FROM users WHERE id = ?');
  $st->execute([$uid]);
  $p = json_decode((string)$st->fetchColumn(), true);
  if (!is_array($p)) return [];
  $have = $p['badges'] ?? [];
  $new = array_values(array_diff($ids, $have));
  if (!$new) return [];
  $p['badges'] = array_values(array_unique(array_merge($have, $new)));
  $db->prepare('UPDATE users SET profile = ? WHERE id = ?')->execute([json_encode($p, JSON_UNESCAPED_UNICODE), $uid]);
  return $new;
}
