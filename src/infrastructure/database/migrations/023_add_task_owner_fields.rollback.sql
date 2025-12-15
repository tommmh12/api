-- =====================================================
-- Rollback Migration: 023_add_task_owner_fields
-- Purpose: Remove owner fields from tasks table
-- =====================================================

USE nexus_db;

-- Drop the task_ownership_settings table
DROP TABLE IF EXISTS task_ownership_settings;

-- Remove index
DROP INDEX idx_tasks_owner ON tasks;

-- Remove foreign key constraints
ALTER TABLE tasks
DROP FOREIGN KEY fk_tasks_owner,
DROP FOREIGN KEY fk_tasks_owner_assigned_by;

-- Remove columns from tasks table
ALTER TABLE tasks
DROP COLUMN owner_id,
DROP COLUMN owner_assigned_at,
DROP COLUMN owner_assigned_by;
