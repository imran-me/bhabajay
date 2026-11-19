# Admin (core team) on bhabajay.com

The admin desk is `https://bhabajay.com/admin`. It works only for a Bhaba Jay ID whose
role is `core`. Every admin change is CSRF-protected, rate-limited and written to the
`audit_log` table (visible in the desk under "লগ").

## Make the first admin (one time)

1. On the site, open `/id`, choose "নতুন আইডি" and create your account with your
   email and a password (8+ characters). Finish the profile step.
2. In Hostinger (File Manager or SSH), create the file
   `/home/<your-user>/bhabajay-deploy/admin.env` (next to `db.env`, outside `public_html`)
   with one line:

       ADMIN_EMAIL=you@example.com

   (the same email you signed up with).
3. On the site, log out and log in again on `/id`. Because no admin exists yet, that
   account becomes admin (`role = core`).
4. Delete `admin.env`. It is ignored anyway once any admin exists.

More admins: in the desk, tab "ইউজার" → "অ্যাডমিন করো". No credentials are stored in git.

## What the desk does

- Dashboard counts: users, comments, pitches, quiz plays, inbox (unread).
- Comments: approve (দেখাও), hide (লুকাও) or delete.
- Pitches: review flow (status, feedback, mentor) in the "পিচ" tab at the top;
  hide from the public tracker or delete in the tools below.
- Inbox: messages from contact, ask, myth tips and mentors; mark read / unread.
- Users: search, disable / enable an account (login refused), grant / revoke admin.
- Quizzes: create and edit quizzes and questions, publish or unpublish. New quizzes
  play at `/quiz/play/?q=<slug>` and appear on `/quiz` under "নতুন কুইজ". Quizzes that
  ship with the site (`src/data/quizzes.json` → `database/seed/quiz.sql`) are re-seeded
  when the seeds change, so edit those in the repo instead.
- Posts: hide / show a post (affects the API and live lists).

## Database

Tables are created by `database/schema.sql` (idempotent) during deploy:
`users`, `audit_log`, plus `disabled`, `published`, `hidden`, `read_at` columns.
