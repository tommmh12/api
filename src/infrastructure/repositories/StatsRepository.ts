import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import { createLogger } from "../logging/index.js";

const logger = createLogger("StatsRepository");

export class StatsRepository {
  private db = dbPool;

  /**
   * Get dashboard statistics using a single optimized query
   * 
   * Requirements: 6.5 - Refactored from 10 separate queries to 1 query (N+1 fix)
   * Uses UNION ALL to combine all COUNT queries into a single database round-trip
   */
  async getDashboardStats() {
    const [rows] = await this.db.query<RowDataPacket[]>(`
      SELECT 'totalUsers' as metric, COUNT(*) as count FROM users WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'totalProjects', COUNT(*) FROM projects WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'totalTasks', COUNT(*) FROM tasks WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'totalDepartments', COUNT(*) FROM departments WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'activeProjects', COUNT(*) FROM projects WHERE status = 'In Progress' AND deleted_at IS NULL
      UNION ALL
      SELECT 'completedTasks', COUNT(*) FROM tasks WHERE status = 'Done' AND deleted_at IS NULL
      UNION ALL
      SELECT 'pendingTasks', COUNT(*) FROM tasks WHERE status IN ('Planning', 'In Progress') AND deleted_at IS NULL
      UNION ALL
      SELECT 'totalForumPosts', COUNT(*) FROM forum_posts WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'totalNewsArticles', COUNT(*) FROM news_articles WHERE status = 'Published' AND deleted_at IS NULL
      UNION ALL
      SELECT 'upcomingEvents', COUNT(*) FROM events WHERE status = 'Upcoming' AND deleted_at IS NULL
    `);

    // Convert array of {metric, count} to object
    const stats: Record<string, number> = {};
    rows.forEach(row => {
      stats[row.metric] = row.count;
    });

    return {
      totalUsers: stats.totalUsers || 0,
      totalProjects: stats.totalProjects || 0,
      totalTasks: stats.totalTasks || 0,
      totalDepartments: stats.totalDepartments || 0,
      activeProjects: stats.activeProjects || 0,
      completedTasks: stats.completedTasks || 0,
      pendingTasks: stats.pendingTasks || 0,
      totalForumPosts: stats.totalForumPosts || 0,
      totalNewsArticles: stats.totalNewsArticles || 0,
      upcomingEvents: stats.upcomingEvents || 0,
    };
  }

  async getRecentActivities(limit: number = 10) {
    const [activities] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        a.id,
        a.user_id as userId,
        u.full_name as userName,
        u.avatar_url as userAvatar,
        a.type,
        a.content,
        a.target,
        a.created_at as createdAt
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?`,
      [limit]
    );

    return activities;
  }

  async getProjectsProgress(limit: number = 5) {
    const [projects] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        p.id,
        p.code,
        p.name,
        p.status,
        p.priority,
        p.progress,
        p.budget,
        p.start_date as startDate,
        p.end_date as endDate,
        GROUP_CONCAT(DISTINCT d.name SEPARATOR ', ') as departmentName,
        u.full_name as managerName
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN project_departments pd ON p.id = pd.project_id
      LEFT JOIN departments d ON pd.department_id = d.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.code, p.name, p.status, p.priority, p.progress, p.budget, p.start_date, p.end_date, u.full_name
      ORDER BY p.created_at DESC
      LIMIT ?`,
      [limit]
    );

    return projects;
  }

  async getProjectsByDepartment() {
    const [projects] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        p.id,
        p.code,
        p.name,
        p.status,
        p.priority,
        p.progress,
        p.budget,
        p.start_date as startDate,
        p.end_date as endDate,
        pd.department_id as departmentId,
        d.name as departmentName,
        u.full_name as managerName
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      LEFT JOIN project_departments pd ON p.id = pd.project_id
      LEFT JOIN departments d ON pd.department_id = d.id
      WHERE p.deleted_at IS NULL
      ORDER BY d.name, p.created_at DESC`
    );

    // Group by department
    const grouped = projects.reduce((acc: any, project: any) => {
      const deptName = project.departmentName || "Chưa phân bổ";
      if (!acc[deptName]) {
        acc[deptName] = [];
      }
      acc[deptName].push(project);
      return acc;
    }, {});

    return grouped;
  }

  async getTasksSummary(limit: number = 10) {
    const [tasks] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date as dueDate,
        p.name as projectName,
        u.full_name as assigneeName
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.deleted_at IS NULL
      ORDER BY 
        CASE 
          WHEN t.status = 'In Progress' THEN 1
          WHEN t.status = 'Planning' THEN 2
          ELSE 3
        END,
        t.due_date ASC
      LIMIT ?`,
      [limit]
    );

    return tasks;
  }

  async getUserStats() {
    const [usersByDepartment] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        d.name as department,
        COUNT(u.id) as count
      FROM departments d
      LEFT JOIN users u ON d.id = u.department_id AND u.deleted_at IS NULL
      GROUP BY d.id, d.name
      ORDER BY count DESC`
    );

    const [usersByRole] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        role,
        COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY role`
    );

    return {
      byDepartment: usersByDepartment,
      byRole: usersByRole,
    };
  }

  async getProjectStats() {
    const [projectsByStatus] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        status,
        COUNT(*) as count
      FROM projects
      WHERE deleted_at IS NULL
      GROUP BY status`
    );

    const [projectsByPriority] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        priority,
        COUNT(*) as count
      FROM projects
      WHERE deleted_at IS NULL
      GROUP BY priority`
    );

    return {
      byStatus: projectsByStatus,
      byPriority: projectsByPriority,
    };
  }

  async getTaskStats() {
    const [tasksByStatus] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        status,
        COUNT(*) as count
      FROM tasks
      WHERE deleted_at IS NULL
      GROUP BY status`
    );

    const [tasksByPriority] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        priority,
        COUNT(*) as count
      FROM tasks
      WHERE deleted_at IS NULL
      GROUP BY priority`
    );

    return {
      byStatus: tasksByStatus,
      byPriority: tasksByPriority,
    };
  }

  /**
   * Get personalized dashboard data for an employee
   * Each query has its own try-catch to prevent cascade failures
   */
  async getEmployeePersonalDashboard(userId: string) {
    logger.debug("getEmployeePersonalDashboard called", { userId });

    // Default values - always return valid structure
    const personalStats = { pendingTasks: 0, meetingsToday: 0, projectCount: 0 };
    let myTasks: any[] = [];
    let mySchedule: any[] = [];
    let recentNews: any[] = [];

    // 1. Get pending tasks count
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM tasks t
         JOIN task_assignees ta ON t.id = ta.task_id
         WHERE ta.user_id = ? AND t.status IN ('Planning', 'In Progress') AND t.deleted_at IS NULL`,
        [userId]
      );
      personalStats.pendingTasks = result[0]?.count || 0;
      logger.debug("Query 1 OK: pendingTasks", { pendingTasks: personalStats.pendingTasks });
    } catch (err: any) {
      logger.error("Query 1 failed (tasks)", err, { userId });
    }

    // 2. Get meetings today count
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT m.id) as count FROM online_meetings m
         LEFT JOIN online_meeting_participants mp ON m.id = mp.meeting_id
         WHERE (m.host_id = ? OR mp.user_id = ?)
           AND DATE(m.scheduled_start) = CURDATE()
           AND m.status != 'cancelled'`,
        [userId, userId]
      );
      personalStats.meetingsToday = result[0]?.count || 0;
      logger.debug("Query 2 OK: meetingsToday", { meetingsToday: personalStats.meetingsToday });
    } catch (err: any) {
      logger.error("Query 2 failed (meetings)", err, { userId });
    }

    // 3. Get project count (simplified - removed department join)
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT p.id) as count FROM projects p
         LEFT JOIN project_members pm ON p.id = pm.project_id
         WHERE (pm.user_id = ? OR p.manager_id = ?) AND p.deleted_at IS NULL`,
        [userId, userId]
      );
      personalStats.projectCount = result[0]?.count || 0;
      logger.debug("Query 3 OK: projectCount", { projectCount: personalStats.projectCount });
    } catch (err: any) {
      logger.error("Query 3 failed (projects)", err, { userId });
    }

    // 4. Get user's assigned tasks (top 5)
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date as dueDate, p.name as projectName
         FROM tasks t
         JOIN task_assignees ta ON t.id = ta.task_id
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE ta.user_id = ? AND t.status != 'Done' AND t.deleted_at IS NULL
         ORDER BY CASE t.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, t.due_date ASC
         LIMIT 5`,
        [userId]
      );
      myTasks = result;
      logger.debug("Query 4 OK: myTasks", { count: myTasks.length });
    } catch (err: any) {
      logger.error("Query 4 failed (myTasks)", err, { userId });
    }

    // 5. Get today's online meetings
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT m.id, m.title,
           DATE_FORMAT(m.scheduled_start, '%H:%i') as startTime,
           DATE_FORMAT(m.scheduled_end, '%H:%i') as endTime,
           'online' as type,
           CASE 
             WHEN m.scheduled_start <= NOW() AND m.scheduled_end >= NOW() THEN 'ongoing'
             WHEN m.scheduled_start > NOW() THEN 'upcoming'
             ELSE 'done'
           END as status
         FROM online_meetings m
         LEFT JOIN online_meeting_participants mp ON m.id = mp.meeting_id
         WHERE (m.host_id = ? OR mp.user_id = ?)
           AND DATE(m.scheduled_start) = CURDATE()
           AND m.status != 'cancelled'
         GROUP BY m.id
         ORDER BY m.scheduled_start ASC`,
        [userId, userId]
      );
      mySchedule = result;
      logger.debug("Query 5 OK: online meetings", { count: mySchedule.length });
    } catch (err: any) {
      logger.error("Query 5 failed (onlineMeetings)", err, { userId });
    }

    // 6. Get recent news (top 5) - simplified where clause
    try {
      const [result] = await this.db.query<RowDataPacket[]>(
        `SELECT n.id, n.title, n.category, n.cover_image as coverImage, n.published_at as publishedAt, u.full_name as authorName
         FROM news_articles n
         LEFT JOIN users u ON n.author_id = u.id
         WHERE n.status = 'Published' AND n.deleted_at IS NULL
         ORDER BY n.published_at DESC
         LIMIT 5`
      );
      recentNews = result;
      logger.debug("Query 6 OK: recentNews", { count: recentNews.length });
    } catch (err: any) {
      logger.error("Query 6 failed (news)", err, { userId });
    }

    logger.debug("Dashboard data ready, returning", { userId });
    return { personalStats, myTasks, mySchedule, recentNews };
  }
}
