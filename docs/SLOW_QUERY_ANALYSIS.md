# Slow Query Analysis Report

## Overview

This document analyzes the database queries in the Nexus system to identify potential performance issues, missing indexes, and N+1 query patterns.

**Analysis Date:** December 14, 2025  
**Requirements:** 6.2 (Query Optimization), 6.5 (N+1 Query Refactoring)

---

## 1. Identified Slow Query Patterns

### 1.1 Dashboard Statistics Queries (StatsRepository)

**Location:** `backend/src/infrastructure/repositories/StatsRepository.ts`

**Issue:** The `getDashboardStats()` method previously executed 10 separate COUNT queries sequentially.

**Impact:** High latency for dashboard loading (10 round trips to database)

**Resolution:** ✅ FIXED - Combined into a single query using UNION ALL

```sql
SELECT 'totalUsers' as metric, COUNT(*) as count FROM users WHERE deleted_at IS NULL
UNION ALL
SELECT 'totalProjects', COUNT(*) FROM projects WHERE deleted_at IS NULL
-- ... etc
```

**Status:** ✅ Fixed + Mitigated by caching (CacheService with 1-minute TTL)

---

### 1.2 Project List with Subqueries

**Location:** `backend/src/infrastructure/repositories/ProjectRepository.ts`

**Issue:** Previously used correlated subqueries that executed for each row in the result set.

**Impact:** O(n) additional queries where n = number of projects

**Resolution:** ✅ FIXED - Refactored to use pre-aggregated LEFT JOIN

```sql
SELECT p.*, COALESCE(tc.taskCount, 0) as taskCount, ...
FROM projects p
LEFT JOIN (
  SELECT project_id, COUNT(*) as taskCount, ...
  FROM tasks WHERE deleted_at IS NULL
  GROUP BY project_id
) tc ON p.id = tc.project_id
```

**Status:** ✅ Fixed in getAllProjects() and getProjectsByUserId()

---

### 1.3 Task Assignees JSON Aggregation

**Location:** `backend/src/infrastructure/repositories/TaskRepository.ts`

**Query:**
```sql
SELECT t.*, 
  (SELECT JSON_ARRAYAGG(...) FROM task_assignees ta JOIN users u2...) as assignees
FROM tasks t
```

**Issue:** Correlated subquery with JSON aggregation for each task.

**Impact:** Performance degrades with large task lists.

**Recommendation:** Consider batch loading assignees separately and merging in application code.

---

## 2. Missing Indexes Analysis

### 2.1 High-Priority Missing Indexes

| Table | Column(s) | Query Pattern | Priority |
|-------|-----------|---------------|----------|
| `tasks` | `(project_id, deleted_at, status)` | Task filtering by project | HIGH |
| `tasks` | `(owner_id)` | Task owner lookups | HIGH |
| `tasks` | `(blocked_at)` | Blocked tasks queries | MEDIUM |
| `task_assignees` | `(user_id, task_id)` | User's assigned tasks | HIGH |
| `task_checklist_items` | `(task_id, is_mandatory, is_completed)` | Mandatory checklist validation | MEDIUM |
| `comments` | `(commentable_type, commentable_id, deleted_at)` | Comment thread loading | HIGH |
| `news_articles` | `(status, deleted_at, published_at)` | Published news listing | MEDIUM |
| `forum_posts` | `(status, deleted_at, is_pinned)` | Forum post listing | MEDIUM |
| `project_members` | `(user_id, project_id)` | User's projects lookup | HIGH |
| `activity_logs` | `(created_at)` | Recent activities | MEDIUM |
| `online_meetings` | `(host_id, scheduled_start)` | User's meetings | MEDIUM |
| `online_meeting_participants` | `(user_id, meeting_id)` | Meeting participants | MEDIUM |
| `security_audit_logs` | `(user_id, created_at)` | Audit log queries | MEDIUM |
| `token_blacklist` | `(token, expires_at)` | Token validation | HIGH |
| `handoff_records` | `(task_id, status)` | Handoff lookups | MEDIUM |
| `task_status_history` | `(task_id, changed_at)` | Status history | MEDIUM |
| `decision_records` | `(project_id, status)` | Decision lookups | LOW |

### 2.2 Existing Indexes (Already Present)

| Table | Index | Columns |
|-------|-------|---------|
| `users` | `idx_users_email` | `(email)` |
| `users` | `idx_users_department` | `(department_id)` |
| `users` | `idx_users_status` | `(status, deleted_at)` |
| `projects` | `idx_projects_code` | `(code)` |
| `projects` | `idx_projects_status` | `(status, deleted_at)` |
| `projects` | `idx_projects_manager` | `(manager_id)` |
| `tasks` | `idx_tasks_project` | `(project_id)` |
| `tasks` | `idx_tasks_status` | `(status)` |
| `tasks` | `idx_tasks_due_date` | `(due_date, completed_at)` |
| `user_sessions` | `idx_sessions_token` | `(token)` |
| `user_sessions` | `idx_sessions_expires` | `(expires_at)` |

---

## 3. N+1 Query Patterns

### 3.1 Tag Insertion Loops

**Location:** `ForumRepository.ts`, `NewsRepository.ts`

**Issue:** Previously used loop with individual INSERT queries for each tag.

**Impact:** N queries for N tags

**Resolution:** ✅ FIXED - Refactored to use batch INSERT

```typescript
const tagValues = post.tags.map(tag => [crypto.randomUUID(), postId, tag]);
await this.db.query(
  `INSERT INTO forum_post_tags (id, post_id, tag_name) VALUES ?`,
  [tagValues]
);
```

**Status:** ✅ Fixed in ForumRepository.create(), ForumRepository.update(), NewsRepository.create(), NewsRepository.update()

---

### 3.2 Group Member Insertion

**Location:** `GroupChatRepository.ts`

**Issue:** Previously used loop with individual INSERT queries for each member.

**Impact:** N queries for N members

**Resolution:** ✅ FIXED - Refactored to use batch INSERT

```typescript
const values = userIds.map((userId) => [crypto.randomUUID(), groupId, userId, role]);
await this.db.query(
  `INSERT INTO group_members (id, group_id, user_id, role) VALUES ?`,
  [values]
);
```

**Status:** ✅ Fixed in GroupChatRepository.addGroupMembers()

---

## 4. Query Optimization Recommendations

### 4.1 Dashboard Stats Optimization

**Current:** 10 sequential queries  
**Optimized:** Single query with UNION ALL

```sql
SELECT 'users' as metric, COUNT(*) as count FROM users WHERE deleted_at IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE deleted_at IS NULL
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks WHERE deleted_at IS NULL
-- ... etc
```

**Status:** ✅ Mitigated by caching

---

### 4.2 Project Task Counts Optimization

**Current:** Correlated subqueries  
**Optimized:** Pre-aggregated JOIN

```sql
SELECT p.*, 
  COALESCE(tc.total, 0) as taskCount,
  COALESCE(tc.completed, 0) as completedTaskCount
FROM projects p
LEFT JOIN (
  SELECT project_id, 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as completed
  FROM tasks 
  WHERE deleted_at IS NULL
  GROUP BY project_id
) tc ON p.id = tc.project_id
```

---

## 5. Performance Monitoring Queries

### 5.1 Identify Slow Queries (MySQL)

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1; -- 1 second threshold

-- View slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 20;
```

### 5.2 Check Index Usage

```sql
-- Show index statistics
SHOW INDEX FROM tasks;

-- Check if indexes are being used
EXPLAIN SELECT * FROM tasks WHERE project_id = 'xxx' AND deleted_at IS NULL;
```

---

## 6. Implementation Priority

### Phase 1 (Immediate)
1. ✅ Add composite index on `tasks(project_id, deleted_at, status)`
2. ✅ Add index on `task_assignees(user_id)`
3. ✅ Add composite index on `comments(commentable_type, commentable_id, deleted_at)`
4. ✅ Add index on `tasks(owner_id)`

### Phase 2 (Short-term)
1. Add index on `project_members(user_id)`
2. Add index on `activity_logs(created_at)`
3. Add composite index on `news_articles(status, deleted_at)`
4. Add composite index on `forum_posts(status, deleted_at, is_pinned)`

### Phase 3 (As Needed)
1. Refactor N+1 tag insertion to batch INSERT
2. Optimize dashboard stats query (if cache miss rate is high)
3. Add remaining indexes based on query patterns

---

## 7. Monitoring Recommendations

1. **Enable MySQL Slow Query Log** in production
2. **Set threshold** to 500ms initially, reduce to 200ms after optimization
3. **Review weekly** for new slow query patterns
4. **Monitor cache hit rates** for dashboard queries
5. **Track query execution times** via MetricsService

---

## Appendix: Index Creation Scripts

See migration file: `031_add_performance_indexes.sql`
