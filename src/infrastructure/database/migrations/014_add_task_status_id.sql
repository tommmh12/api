-- =====================================================
-- Migration: Add status_id to tasks for workflow integration
-- =====================================================

USE nexus_db;

-- Add status_id column to tasks
ALTER TABLE tasks 
ADD COLUMN status_id CHAR(36) DEFAULT NULL AFTER status;

-- Add foreign key constraint
ALTER TABLE tasks 
ADD CONSTRAINT fk_task_workflow_status 
FOREIGN KEY (status_id) REFERENCES workflow_statuses(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_tasks_status_id ON tasks(status_id);

-- Migrate existing tasks: Map old status text to workflow statuses
-- This assumes a default workflow exists with matching status names

-- First, update tasks that belong to projects with workflow_id
UPDATE tasks t
JOIN projects p ON t.project_id = p.id
JOIN workflow_statuses ws ON ws.workflow_id = p.workflow_id AND ws.name = t.status
SET t.status_id = ws.id
WHERE p.workflow_id IS NOT NULL;

-- For tasks without matching workflow status, try to match by status name from any workflow
UPDATE tasks t
SET t.status_id = (
    SELECT ws.id FROM workflow_statuses ws
    JOIN projects p ON p.id = t.project_id AND p.workflow_id = ws.workflow_id
    WHERE ws.name = t.status
    LIMIT 1
)
WHERE t.status_id IS NULL;
