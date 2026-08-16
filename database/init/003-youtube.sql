ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS planning_center_refresh_token TEXT NULL AFTER planning_center_user_agent,
  ADD COLUMN IF NOT EXISTS planning_center_refresh_iv CHAR(24) NULL AFTER planning_center_refresh_token,
  ADD COLUMN IF NOT EXISTS planning_center_refresh_tag CHAR(32) NULL AFTER planning_center_refresh_iv;

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
  PRIMARY KEY (id), UNIQUE KEY youtube_accounts_channel_id_unique (channel_id),
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
  PRIMARY KEY (id), UNIQUE KEY youtube_broadcasts_youtube_id_unique (youtube_broadcast_id),
  CONSTRAINT youtube_broadcasts_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT youtube_broadcasts_account_id_foreign FOREIGN KEY (youtube_account_id) REFERENCES youtube_accounts (id) ON DELETE CASCADE,
  CONSTRAINT youtube_broadcasts_created_by_foreign FOREIGN KEY (created_by) REFERENCES users (id)
);
