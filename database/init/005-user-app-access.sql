CREATE TABLE IF NOT EXISTS user_app_access (
  user_id BIGINT UNSIGNED NOT NULL,
  app_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_key),
  CONSTRAINT user_app_access_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT IGNORE INTO user_app_access (user_id, app_key)
SELECT id, 'youtube' FROM users WHERE role = 'user';
