-- =====================================================
-- Rollback Migration: 025_add_task_blocking_fields
-- Description: Remove blocking fields from tasks table
-- =====================================================

USE nexus_db;

-- Drop index
DROP INDEX idx_tasks_blocked ON tasks;

-- Drop foreign key
ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_blocked_by;

-- Remove blocking columns
ALTER TABLE tasks
DROP COLUMN blocked_reason,
DROP COLUMN blocked_at,
DROP COLUMN blocked_by;
