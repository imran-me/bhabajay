-- Bhaba Jay MySQL schema (Hostinger, MySQL 8 / MariaDB 10.6+, utf8mb4)
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.

-- ───────── Quiz content (seed: database/seed/quiz.sql) ─────────
CREATE TABLE IF NOT EXISTS quizzes (
  slug        VARCHAR(64)  NOT NULL PRIMARY KEY,
  kind        VARCHAR(16)  NOT NULL,
  title       VARCHAR(200) NOT NULL,
  blurb       VARCHAR(500) NOT NULL DEFAULT '',
  opens_at    DATETIME     NULL,
  seconds_per_question TINYINT UNSIGNED NOT NULL DEFAULT 20,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  quiz_slug   VARCHAR(64)  NOT NULL,
  position    SMALLINT UNSIGNED NOT NULL,
  question    VARCHAR(500) NOT NULL,
  option_a    VARCHAR(200) NOT NULL,
  option_b    VARCHAR(200) NOT NULL,
  option_c    VARCHAR(200) NOT NULL,
  option_d    VARCHAR(200) NOT NULL,
  answer      TINYINT UNSIGNED NOT NULL,
  fact        TEXT         NOT NULL,
  image       VARCHAR(255) NULL,
  image_alt   VARCHAR(300) NULL,
  credit      VARCHAR(300) NULL,
  KEY idx_quiz (quiz_slug, position),
  CONSTRAINT fk_q_quiz FOREIGN KEY (quiz_slug) REFERENCES quizzes(slug) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────── Community / demo-mode features ─────────
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_slug   VARCHAR(64)  NOT NULL,
  nickname    VARCHAR(40)  NOT NULL,
  school_id   VARCHAR(64)  NULL,
  district    VARCHAR(64)  NULL,
  score       SMALLINT UNSIGNED NOT NULL,
  total       SMALLINT UNSIGNED NOT NULL,
  points      SMALLINT UNSIGNED NOT NULL,
  duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
  ip_hash     CHAR(64)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_quiz (quiz_slug),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pitches (
  code        VARCHAR(16)  NOT NULL PRIMARY KEY,
  status      VARCHAR(16)  NOT NULL DEFAULT 'sent',
  title       VARCHAR(200) NOT NULL,
  subject     VARCHAR(300) NOT NULL,
  nickname    VARCHAR(40)  NOT NULL,
  contact_email VARCHAR(200) NOT NULL,
  payload     JSON         NOT NULL,
  feedback    TEXT         NULL,
  mentor_name VARCHAR(100) NULL,
  history     JSON         NOT NULL,
  ip_hash     CHAR(64)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(16)  NOT NULL,
  target_id   VARCHAR(100) NOT NULL,
  nickname    VARCHAR(40)  NOT NULL,
  avatar      JSON         NULL,
  body        VARCHAR(1000) NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'pending',
  ip_hash     CHAR(64)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_target (target_type, target_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inbox (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind        VARCHAR(16)  NOT NULL,
  fields      JSON         NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'new',
  ip_hash     CHAR(64)     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_kind (kind, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- simple per-IP rate limit buckets (see public/api/_lib.php)
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket      VARCHAR(100) NOT NULL PRIMARY KEY,
  hits        INT UNSIGNED NOT NULL DEFAULT 0,
  window_start INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
