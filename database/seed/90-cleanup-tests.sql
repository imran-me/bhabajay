-- Removes only the clearly-marked API test rows created while verifying the live site
-- (nickname / title / message "TEST-agent-a"). Idempotent; touches nothing else.
DELETE FROM quiz_attempts WHERE nickname = 'TEST-agent-a';
DELETE FROM comments WHERE nickname = 'TEST-agent-a';
DELETE FROM pitches WHERE title = 'TEST-agent-a' AND nickname = 'TEST-agent-a';
DELETE FROM inbox WHERE JSON_UNQUOTE(JSON_EXTRACT(fields, '$.message')) = 'TEST-agent-a';
DELETE FROM comments WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email = 'test-agent-a@example.com') t);
DELETE FROM quiz_attempts WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email = 'test-agent-a@example.com') t);
DELETE FROM users WHERE email = 'test-agent-a@example.com';
