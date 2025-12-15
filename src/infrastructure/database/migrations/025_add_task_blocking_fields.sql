-- =====================================================
-- Migration: 025_add_task_blocking_fields
-- Description: Add blocking fields to tasks table for task blocking workflow
-- Requirements: 8.4 - Task blocking reason requirement
-- =====================================================

USE nexus_db;

-- Add blocking fields to tasks table
ALTER TABLE tasks
ADD COLUMN blocked_reason TEXT NULL COMMENT 'Reason why the task is blocked',
ADD COLUMN blocked_at TIMESTAMP NULL COMMENT 'When the task was blocked',
ADD COLUMN blocked_by CHAR(36) NULL COMMENT 'User who blocked the task';

-- Add foreign key for blocked_by
ALTER TABLE tasks
ADD CONSTRAINT fk_tasks_blocked_by 
FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying blocked tasks
CREATE INDEX idx_tasks_blocked ON tasks(blocked_at, blocked_reason(100));
