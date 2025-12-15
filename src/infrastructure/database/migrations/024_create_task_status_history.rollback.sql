-- =====================================================
-- Rollback Migration: 024_create_task_status_history
-- Description: Drop task_status_history table
-- =====================================================

USE nexus_db;

DROP TABLE IF EXISTS task_status_history;
