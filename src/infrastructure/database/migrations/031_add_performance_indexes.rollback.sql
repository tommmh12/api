-- =====================================================
-- Rollback: 031_add_performance_indexes
-- Purpose: Remove performance indexes
-- =====================================================

USE nexus_db;

-- HIGH PRIORITY INDEXES
DROP INDEX IF EXISTS idx_tasks_project_deleted_status ON tasks;
DROP INDEX IF EXISTS idx_tasks_owner ON tasks;
DROP INDEX IF EXISTS idx_tasks_blocked ON tasks;
DROP INDEX IF EXISTS idx_task_assignees_user ON task_assignees;
DROP INDEX IF EXISTS idx_comments_thread ON comments;
DROP INDEX IF EXISTS idx_token_blacklist_token_expires ON token_blacklist;

-- MEDIUM PRIORITY INDEXES
DROP INDEX IF EXISTS idx_checklist_mandatory ON task_checklist_items;
DROP INDEX IF EXISTS idx_news_status_published ON news_articles;
DROP INDEX IF EXISTS idx_forum_status_pinned ON forum_posts;
DROP INDEX IF EXISTS idx_activity_logs_created ON activity_logs;
DROP INDEX IF EXISTS idx_meetings_host_schedule ON online_meetings;
DROP INDEX IF EXISTS idx_meeting_participants_user ON online_meeting_participants;
DROP INDEX IF EXISTS idx_audit_logs_user_created ON security_audit_logs;
DROP INDEX IF EXISTS idx_handoff_task_status ON handoff_records;
DROP INDEX IF EXISTS idx_task_status_history_task ON task_status_history;

-- LOW PRIORITY INDEXES
DROP INDEX IF EXISTS idx_decision_records_project ON decision_records;
DROP INDEX IF EXISTS idx_decision_records_task ON decision_records;
DROP INDEX IF EXISTS idx_sessions_user_expires ON user_sessions;
