CREATE TABLE IF NOT EXISTS integrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  status ENUM('planned', 'connected', 'error', 'disabled') NOT NULL DEFAULT 'planned',
  configuration JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY integrations_provider_unique (provider)
);

INSERT IGNORE INTO integrations (provider, display_name, status) VALUES
  ('youtube', 'YouTube', 'planned'),
  ('planning-center', 'Planning Center', 'planned'),
  ('podcast', 'Podcast', 'planned'),
  ('visitor-counter', 'Besucherzähler', 'planned'),
  ('churchtools', 'ChurchTools', 'planned');

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  planning_center_id VARCHAR(100) NOT NULL,
  login_slug VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  time_zone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  planning_center_client_id VARCHAR(255) NULL,
  planning_center_client_secret TEXT NULL,
  planning_center_secret_iv CHAR(24) NULL,
  planning_center_secret_tag CHAR(32) NULL,
  planning_center_user_agent VARCHAR(255) NULL,
  planning_center_refresh_token TEXT NULL,
  planning_center_refresh_iv CHAR(24) NULL,
  planning_center_refresh_tag CHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY organizations_planning_center_id_unique (planning_center_id),
  UNIQUE KEY organizations_login_slug_unique (login_slug)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  planning_center_user_id VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  status ENUM('pending', 'active', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_planning_center_user_id_unique (planning_center_user_id),
  UNIQUE KEY users_organization_email_unique (organization_id, email),
  KEY users_organization_id_index (organization_id),
  CONSTRAINT users_organization_id_foreign
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_token_hash_unique (token_hash),
  KEY sessions_user_id_index (user_id),
  KEY sessions_expires_at_index (expires_at),
  CONSTRAINT sessions_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_app_access (
  user_id BIGINT UNSIGNED NOT NULL,
  app_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, app_key),
  CONSTRAINT user_app_access_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS youtube_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  channel_id VARCHAR(100) NOT NULL,
  channel_title VARCHAR(255) NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_token_iv CHAR(24) NOT NULL,
  refresh_token_tag CHAR(32) NOT NULL,
  reusable_stream_id VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY youtube_accounts_channel_id_unique (channel_id),
  KEY youtube_accounts_organization_id_index (organization_id),
  CONSTRAINT youtube_accounts_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS youtube_settings (
  organization_id BIGINT UNSIGNED NOT NULL,
  service_type_id VARCHAR(100) NULL,
  service_type_name VARCHAR(255) NULL,
  title_template VARCHAR(500) NOT NULL DEFAULT '{plan.title} | {team.Verkündigung} | {organization.name}',
  description_template TEXT NULL,
  start_item_title VARCHAR(255) NULL,
  privacy_status ENUM('private', 'unlisted', 'public') NOT NULL DEFAULT 'unlisted',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id),
  CONSTRAINT youtube_settings_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS youtube_broadcasts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  youtube_account_id BIGINT UNSIGNED NOT NULL,
  planning_center_plan_id VARCHAR(100) NOT NULL,
  youtube_broadcast_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  scheduled_start_at TIMESTAMP NOT NULL,
  playlist_id VARCHAR(100) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY youtube_broadcasts_youtube_id_unique (youtube_broadcast_id),
  CONSTRAINT youtube_broadcasts_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT youtube_broadcasts_account_id_foreign FOREIGN KEY (youtube_account_id) REFERENCES youtube_accounts (id) ON DELETE CASCADE,
  CONSTRAINT youtube_broadcasts_created_by_foreign FOREIGN KEY (created_by) REFERENCES users (id)
);
