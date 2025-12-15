-- =====================================================
-- Rollback Migration: 026_create_task_dependencies
-- Description: Drop task_dependencies table
-- =====================================================

USE nexus_db;

DROP TABLE IF EXISTS task_dependencies;
