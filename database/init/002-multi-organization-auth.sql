ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS login_slug VARCHAR(100) NULL AFTER planning_center_id,
  ADD COLUMN IF NOT EXISTS planning_center_client_id VARCHAR(255) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS planning_center_client_secret TEXT NULL AFTER planning_center_client_id,
  ADD COLUMN IF NOT EXISTS planning_center_secret_iv CHAR(24) NULL AFTER planning_center_client_secret,
  ADD COLUMN IF NOT EXISTS planning_center_secret_tag CHAR(32) NULL AFTER planning_center_secret_iv,
  ADD COLUMN IF NOT EXISTS planning_center_user_agent VARCHAR(255) NULL AFTER planning_center_secret_tag;

UPDATE organizations
SET login_slug = CONCAT('gemeinde-', id)
WHERE login_slug IS NULL OR login_slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS organizations_login_slug_unique ON organizations (login_slug);

ALTER TABLE users
  MODIFY COLUMN planning_center_user_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL AFTER email;

CREATE UNIQUE INDEX IF NOT EXISTS users_organization_email_unique ON users (organization_id, email);
