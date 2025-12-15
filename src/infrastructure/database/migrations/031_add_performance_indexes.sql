-- =====================================================
-- Migration: 031_add_performance_indexes
-- Purpose: Add missing indexes for query optimization
-- Requirements: 6.2 (Query Optimization)
-- =====================================================

USE nexus_db;

-- =====================================================
-- HIGH PRIORITY INDEXES
-- =====================================================

-- Tasks: Composite index for project task queries
-- Used by: getTasksByProjectId, getAllProjects (task counts)
CREATE INDEX idx_tasks_project_deleted_status 
ON tasks(project_id, deleted_at, status);

-- Tasks: Owner lookup index
-- Used by: Task ownership queries, filtering by owner
CREATE INDEX idx_tasks_owner 
ON tasks(owner_id);

-- Tasks: Blocked tasks queries
-- Used by: getBlockedTasksByProjectId
CREATE INDEX idx_tasks_blocked 
ON tasks(blocked_at);

-- Task Assignees: User's assigned tasks lookup
-- Used by: getTasksByUserId, getEmployeePersonalDashboard
CREATE INDEX idx_task_assignees_user 
ON task_assignees(user_id);

-- Comments: Thread loading optimization
-- Used by: findByThread (CommentRepository)
CREATE INDEX idx_comments_thread 
ON comments(commentable_type, commentable_id, deleted_at);

-- Token Blacklist: Token validation
-- Used by: TokenBlacklistService.isBlacklisted
CREATE INDEX idx_token_blacklist_token_expires 
ON token_blacklist(token(255), expires_at);

-- =====================================================
-- MEDIUM PRIORITY INDEXES
-- =====================================================

-- Task Checklist Items: Mandatory validation
-- Used by: getUncompletedMandatoryItems
CREATE INDEX idx_checklist_mandatory 
ON task_checklist_items(task_id, is_mandatory, is_completed);

-- News Articles: Published listing
-- Used by: findAll with status filter
CREATE INDEX idx_news_status_published 
ON news_articles(status, deleted_at, published_at);

-- Forum Posts: Post listing with pinned priority
-- Used by: findAll with status filter
CREATE INDEX idx_forum_status_pinned 
ON forum_posts(status, deleted_at, is_pinned);

-- Activity Logs: Recent activities
-- Used by: getRecentActivities
CREATE INDEX idx_activity_logs_created 
ON activity_logs(created_at DESC);

-- Online Meetings: User's meetings lookup
-- Used by: getEmployeePersonalDashboard
CREATE INDEX idx_meetings_host_schedule 
ON online_meetings(host_id, scheduled_start);

-- Online Meeting Participants: Participant lookup
-- Used by: Meeting participant queries
CREATE INDEX idx_meeting_participants_user 
ON online_meeting_participants(user_id);

-- Security Audit Logs: User audit trail
-- Used by: Audit log queries
CREATE INDEX idx_audit_logs_user_created 
ON security_audit_logs(user_id, created_at);

-- Handoff Records: Task handoff lookup
-- Used by: HandoffRepository queries
CREATE INDEX idx_handoff_task_status 
ON handoff_records(task_id, status);

-- Task Status History: Status history lookup
-- Used by: TaskStatusHistoryRepository
CREATE INDEX idx_task_status_history_task 
ON task_status_history(task_id, changed_at);

-- =====================================================
-- LOW PRIORITY INDEXES
-- =====================================================

-- Decision Records: Project decisions lookup
-- Used by: DecisionRecordRepository
CREATE INDEX idx_decision_records_project 
ON decision_records(project_id, status);

-- Decision Records: Task decisions lookup
CREATE INDEX idx_decision_records_task 
ON decision_records(task_id, status);

-- User Sessions: User session lookup
-- Used by: Session validation
CREATE INDEX idx_sessions_user_expires 
ON user_sessions(user_id, expires_at);

-- =====================================================
-- VERIFY INDEXES
-- =====================================================

-- Show all indexes on key tables for verification
-- SHOW INDEX FROM tasks;
-- SHOW INDEX FROM task_assignees;
-- SHOW INDEX FROM comments;
-- SHOW INDEX FROM news_articles;
-- SHOW INDEX FROM forum_posts;
