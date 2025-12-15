-- =====================================================
-- Migration: 029_add_checklist_mandatory_field
-- Description: Add is_mandatory field to task_checklist_items table
-- Requirements: 11.2 - Warn before task completion if mandatory items unchecked
-- =====================================================

USE nexus_db;

-- Add is_mandatory field to task_checklist_items table
-- Default to FALSE for backward compatibility with existing items
ALTER TABLE task_checklist_items
    ADD COLUMN is_mandatory BOOLEAN DEFAULT FALSE AFTER is_completed;

-- Add index for querying mandatory items
ALTER TABLE task_checklist_items
    ADD INDEX idx_checklist_mandatory (is_mandatory, is_completed);
