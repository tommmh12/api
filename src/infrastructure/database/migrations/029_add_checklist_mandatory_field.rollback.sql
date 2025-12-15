-- =====================================================
-- Rollback Migration: 029_add_checklist_mandatory_field
-- Description: Remove is_mandatory field from task_checklist_items table
-- =====================================================

USE nexus_db;

-- Remove index
ALTER TABLE task_checklist_items
    DROP INDEX IF EXISTS idx_checklist_mandatory;

-- Remove is_mandatory column
ALTER TABLE task_checklist_items
    DROP COLUMN IF EXISTS is_mandatory;
