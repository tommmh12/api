import { dbPool } from "../database/connection.js";
import { Department } from "../../domain/entities/Department.js";

export class DepartmentRepository {
  private db = dbPool;

  async findAll(): Promise<Department[]> {
    const [rows] = await this.db.query(`
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.budget,
        d.kpi_status as kpiStatus,
        d.manager_id as managerId,
        u.full_name as managerName,
        u.avatar_url as managerAvatar,
        d.parent_department_id as parentDepartmentId,
        pd.name as parentDepartmentName,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id) as memberCount,
        d.created_at as createdAt,
        d.updated_at as updatedAt
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      LEFT JOIN departments pd ON d.parent_department_id = pd.id
      ORDER BY d.name ASC
    `);
    return rows as Department[];
  }

  async findById(id: string): Promise<Department | null> {
    const [rows] = await this.db.query(
      `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.budget,
        d.kpi_status as kpiStatus,
        d.manager_id as managerId,
        u.full_name as managerName,
        u.avatar_url as managerAvatar,
        d.parent_department_id as parentDepartmentId,
        pd.name as parentDepartmentName,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id) as memberCount,
        d.created_at as createdAt,
        d.updated_at as updatedAt
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      LEFT JOIN departments pd ON d.parent_department_id = pd.id
      WHERE d.id = ?
    `,
      [id]
    );
    const departments = rows as Department[];
    return departments.length > 0 ? departments[0] : null;
  }

  async create(department: Partial<Department>): Promise<Department> {
    const deptId = crypto.randomUUID();
    await this.db.query(
      "INSERT INTO departments (id, name, code, description, budget, kpi_status, manager_id, parent_department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        deptId,
        department.name,
        department.code || null,
        department.description || null,
        department.budget || null,
        department.kpiStatus || null,
        department.managerId || null,
        department.parentDepartmentId || null,
      ]
    );
    const created = await this.findById(deptId);
    if (!created) throw new Error("Failed to create department");
    return created;
  }

  async update(id: string, department: Partial<Department>): Promise<void> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: (string | number | null)[] = [];

    if (department.name !== undefined) {
      updateFields.push("name = ?");
      values.push(department.name);
    }
    if (department.code !== undefined) {
      updateFields.push("code = ?");
      values.push(department.code || null);
    }
    if (department.description !== undefined) {
      updateFields.push("description = ?");
      values.push(department.description || null);
    }
    if (department.budget !== undefined) {
      updateFields.push("budget = ?");
      values.push(department.budget || null);
    }
    if (department.kpiStatus !== undefined) {
      updateFields.push("kpi_status = ?");
      values.push(department.kpiStatus || null);
    }
    if (department.managerId !== undefined) {
      updateFields.push("manager_id = ?");
      values.push(department.managerId || null);
    }
    if (department.parentDepartmentId !== undefined) {
      updateFields.push("parent_department_id = ?");
      values.push(department.parentDepartmentId || null);
    }

    if (updateFields.length === 0) {
      return; // Nothing to update
    }

    values.push(id);
    await this.db.query(
      `UPDATE departments SET ${updateFields.join(", ")} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.query("DELETE FROM departments WHERE id = ?", [id]);
  }

  // --- Manager Handling ---

  /**
   * Update user's department_id to the specified department
   * This ensures the manager is also a member of the department
   */
  async updateUserDepartment(
    userId: string,
    departmentId: string
  ): Promise<void> {
    await this.db.query("UPDATE users SET department_id = ? WHERE id = ?", [
      departmentId,
      userId,
    ]);
  }

  /**
   * Check if a user is a manager of any department (excluding a specific dept)
   * Returns the department info if user is a manager elsewhere, null otherwise
   */
  async checkUserIsManagerElsewhere(
    userId: string,
    excludeDeptId?: string
  ): Promise<{ id: string; name: string } | null> {
    let query = `
      SELECT id, name FROM departments 
      WHERE manager_id = ?
    `;
    const params: any[] = [userId];

    if (excludeDeptId) {
      query += ` AND id != ?`;
      params.push(excludeDeptId);
    }

    const [rows] = await this.db.query<any[]>(query, params);
    return rows.length > 0 ? { id: rows[0].id, name: rows[0].name } : null;
  }

  /**
   * Clear the manager of a department (set manager_id to null)
   */
  async clearDepartmentManager(departmentId: string): Promise<void> {
    await this.db.query(
      "UPDATE departments SET manager_id = NULL WHERE id = ?",
      [departmentId]
    );
  }

  /**
   * Find department by manager ID
   */
  async findDepartmentByManagerId(
    managerId: string
  ): Promise<Department | null> {
    const [rows] = await this.db.query(
      `
      SELECT 
        d.id,
        d.name,
        d.code,
        d.description,
        d.budget,
        d.kpi_status as kpiStatus,
        d.manager_id as managerId,
        u.full_name as managerName,
        u.avatar_url as managerAvatar,
        d.parent_department_id as parentDepartmentId,
        pd.name as parentDepartmentName,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id) as memberCount,
        d.created_at as createdAt,
        d.updated_at as updatedAt
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      LEFT JOIN departments pd ON d.parent_department_id = pd.id
      WHERE d.manager_id = ?
    `,
      [managerId]
    );
    const departments = rows as any[];
    return departments.length > 0 ? departments[0] : null;
  }

  /**
   * Get all employees in a department
   */
  async getDepartmentEmployees(departmentId: string): Promise<any[]> {
    const [rows] = await this.db.query(
      `
      SELECT 
        id,
        full_name,
        email,
        phone,
        position,
        avatar_url,
        status,
        created_at
      FROM users
      WHERE department_id = ? AND status = 'active'
      ORDER BY full_name ASC
    `,
      [departmentId]
    );
    return rows as any[];
  }

  /**
   * Get department task count
   */
  async getDepartmentTaskCount(departmentId: string): Promise<number> {
    const [rows] = await this.db.query(
      `
      SELECT COUNT(*) as count FROM tasks WHERE assignee_department_id = ?
    `,
      [departmentId]
    );
    return (rows as any[])[0]?.count || 0;
  }

  /**
   * Get department completed task count
   */
  async getDepartmentCompletedTaskCount(departmentId: string): Promise<number> {
    const [rows] = await this.db.query(
      `
      SELECT COUNT(*) as count FROM tasks WHERE assignee_department_id = ? AND status = 'completed'
    `,
      [departmentId]
    );
    return (rows as any[])[0]?.count || 0;
  }

  /**
   * Get department attendance rate (0-1)
   */
  async getDepartmentAttendanceRate(departmentId: string): Promise<number> {
    try {
      const [rows] = await this.db.query(
        `
        SELECT 
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
          COUNT(*) as total
        FROM attendance
        WHERE employee_id IN (
          SELECT id FROM users WHERE department_id = ?
        )
        AND date = CURDATE()
      `,
        [departmentId]
      );
      const result = (rows as any[])[0];
      return result?.total > 0 ? result.present / result.total : 0;
    } catch (error: any) {
      // Table doesn't exist - return 0
      if (error.code === "ER_NO_SUCH_TABLE") {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get department active projects count
   */
  async getDepartmentProjectCount(departmentId: string): Promise<number> {
    const [rows] = await this.db.query(
      `
      SELECT COUNT(DISTINCT p.id) as count 
      FROM projects p
      INNER JOIN project_departments pd ON p.id = pd.project_id
      WHERE pd.department_id = ? AND p.status IN ('Planning', 'In Progress', 'Active')
    `,
      [departmentId]
    );
    return (rows as any[])[0]?.count || 0;
  }

  /**
   * Get department completed projects count
   */
  async getDepartmentCompletedProjectCount(
    departmentId: string
  ): Promise<number> {
    const [rows] = await this.db.query(
      `
      SELECT COUNT(DISTINCT p.id) as count 
      FROM projects p
      INNER JOIN project_departments pd ON p.id = pd.project_id
      WHERE pd.department_id = ? AND p.status = 'Completed'
    `,
      [departmentId]
    );
    return (rows as any[])[0]?.count || 0;
  }

  /**
   * Get department leave count (pending leave requests)
   */
  async getDepartmentLeaveCount(departmentId: string): Promise<number> {
    try {
      const [rows] = await this.db.query(
        `
        SELECT COUNT(*) as count 
        FROM leave_requests
        WHERE user_id IN (
          SELECT id FROM users WHERE department_id = ?
        )
        AND status = 'pending'
      `,
        [departmentId]
      );
      return (rows as any[])[0]?.count || 0;
    } catch (error: any) {
      // Table doesn't exist - return 0
      if (error.code === "ER_NO_SUCH_TABLE") {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get all tasks for a department
   */
  async getDepartmentTasks(
    departmentId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    let query = `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assigned_to,
        u.full_name as assigned_to_name,
        t.created_by,
        t.due_date,
        t.progress,
        t.checklist,
        (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comments_count,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.department_id = ?
    `;

    const params: any[] = [departmentId];

    if (startDate) {
      query += ` AND DATE(t.created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(t.created_at) <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY t.due_date ASC`;

    const [rows] = await this.db.query(query, params);
    return rows as any[];
  }

  /**
   * Get department attendance details
   */
  async getDepartmentAttendanceDetails(
    departmentId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    let query = `
      SELECT 
        a.id,
        a.employee_id,
        u.full_name as employee_name,
        a.date,
        a.check_in,
        a.check_out,
        a.status,
        a.duration
      FROM attendance a
      JOIN users u ON a.employee_id = u.id
      WHERE u.department_id = ?
    `;

    const params: any[] = [departmentId];

    if (startDate) {
      query += ` AND DATE(a.date) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(a.date) <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY a.date DESC, u.full_name ASC`;

    const [rows] = await this.db.query(query, params);
    return rows as any[];
  }

  /**
   * Get projects associated with a department
   */
  async getDepartmentProjects(departmentId: string): Promise<any[]> {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.code,
        p.status,
        p.progress,
        p.start_date,
        p.end_date,
        p.priority,
        pd.role as departmentRole,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as memberCount
      FROM projects p
      JOIN project_departments pd ON p.id = pd.project_id
      WHERE pd.department_id = ?
      ORDER BY p.created_at DESC
    `;

    const [rows] = await this.db.query(query, [departmentId]);
    return rows as any[];
  }
}
