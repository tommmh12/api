-- =====================================================
-- Rollback Migration: 028_add_checklist_audit_fields
-- Description: Remove audit fields from task_checklist_items table
--              and drop checklist_state_history table
-- =====================================================

USE nexus_db;

-- Drop the checklist_state_history table
DROP TABLE IF EXISTS checklist_state_history;

-- Remove index
ALTER TABLE task_checklist_items
    DROP INDEX IF EXISTS idx_checklist_completed;

-- Remove foreign key constraints
ALTER TABLE task_checklist_items
    DROP FOREIGN KEY IF EXISTS fk_checklist_completed_by,
    DROP FOREIGN KEY IF EXISTS fk_checklist_unchecked_by;

-- Remove audit columns from task_checklist_items
ALTER TABLE task_checklist_items
    DROP COLUMN IF EXISTS completed_by,
    DROP COLUMN IF EXISTS completed_at,
    DROP COLUMN IF EXISTS unchecked_by,
    DROP COLUMN IF EXISTS unchecked_at,
    DROP COLUMN IF EXISTS unchecked_reason;
