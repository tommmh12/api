-- Migration: 030_create_decision_records
-- Description: Create decision_records table for documenting decisions separately from discussions
-- Requirements: 10.1 - Decision Record with fields for context, decision made, and rationale
-- Requirements: 10.5 - Decision revision with history preservation

-- Create decision_records table
CREATE TABLE IF NOT EXISTS decision_records (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36),
  task_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  context TEXT NOT NULL,
  options_considered JSON,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  consequences TEXT,
  status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(36),
  approved_at DATETIME,
  version INT NOT NULL DEFAULT 1,
  previous_version_id VARCHAR(36),
  superseded_by VARCHAR(36),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  CONSTRAINT fk_decision_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_decision_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  CONSTRAINT fk_decision_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_decision_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_decision_previous_version FOREIGN KEY (previous_version_id) REFERENCES decision_records(id) ON DELETE SET NULL,
  CONSTRAINT fk_decision_superseded_by FOREIGN KEY (superseded_by) REFERENCES decision_records(id) ON DELETE SET NULL,
  
  -- Indexes for common queries
  INDEX idx_decision_project (project_id),
  INDEX idx_decision_task (task_id),
  INDEX idx_decision_status (status),
  INDEX idx_decision_created_by (created_by),
  INDEX idx_decision_created_at (created_at)
);

-- Create decision_comment_links table for linking decisions to comments
-- Requirements: 10.4 - Link between comments and decision records
CREATE TABLE IF NOT EXISTS decision_comment_links (
  id VARCHAR(36) PRIMARY KEY,
  decision_id VARCHAR(36) NOT NULL,
  comment_id VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  CONSTRAINT fk_dcl_decision FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE,
  CONSTRAINT fk_dcl_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate links
  UNIQUE KEY uk_decision_comment (decision_id, comment_id),
  
  -- Indexes
  INDEX idx_dcl_decision (decision_id),
  INDEX idx_dcl_comment (comment_id)
);
