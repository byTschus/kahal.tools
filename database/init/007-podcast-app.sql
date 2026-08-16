ALTER TABLE podcast_jobs
  ADD COLUMN IF NOT EXISTS operation ENUM('publish','delete') NOT NULL DEFAULT 'publish' AFTER end_seconds;

INSERT IGNORE INTO user_app_access (user_id, app_key)
SELECT id, 'podcast' FROM users WHERE role = 'user';
