import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbPool } from "../database/connection.js";
import { User, UserWithDepartment } from "../../domain/entities/User.js";

export class UserRepository {
  async findByEmail(email: string): Promise<UserWithDepartment | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        u.*,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.email = ? AND u.deleted_at IS NULL
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) return null;
    return rows[0] as UserWithDepartment;
  }

  async findById(id: string): Promise<UserWithDepartment | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        u.*,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;
    return rows[0] as UserWithDepartment;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await dbPool.query<ResultSetHeader>(
      "UPDATE users SET last_login_at = NOW() WHERE id = ?",
      [userId]
    );
  }

  /**
   * Create a new user session with metadata
   * 
   * Implements Requirements 1.4:
   * - Store session metadata (IP, User-Agent) on login
   * 
   * @param userId - The user ID
   * @param token - The session token
   * @param expiresAt - When the session expires
   * @param ipAddress - The client IP address
   * @param userAgent - The client User-Agent string
   */
  async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const sessionId = crypto.randomUUID();

    await dbPool.query<ResultSetHeader>(
      `INSERT INTO user_sessions (id, user_id, token, expires_at, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, token, expiresAt, ipAddress || null, userAgent || null]
    );

    return sessionId;
  }

  /**
   * Find a session by token
   * 
   * @param token - The session token
   * @returns The session data including metadata (IP, User-Agent)
   */
  async findSession(token: string): Promise<RowDataPacket | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT * FROM user_sessions 
       WHERE token = ? AND expires_at > NOW() AND deleted_at IS NULL
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Find session by user ID and token for metadata validation
   * 
   * Implements Requirements 1.4:
   * - Retrieve session metadata for consistency validation
   * 
   * @param userId - The user ID
   * @param token - The session token
   * @returns Session data with metadata
   */
  async findSessionByUserAndToken(userId: string, token: string): Promise<{
    id: string;
    user_id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
    expires_at: Date;
  } | null> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, user_id, ip_address, user_agent, created_at, expires_at 
       FROM user_sessions 
       WHERE user_id = ? AND token = ? AND expires_at > NOW()
       LIMIT 1`,
      [userId, token]
    );

    if (rows.length === 0) return null;
    return rows[0] as {
      id: string;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
      expires_at: Date;
    };
  }

  async deleteSession(token: string): Promise<void> {
    await dbPool.query<ResultSetHeader>(
      "DELETE FROM user_sessions WHERE token = ?",
      [token]
    );
  }

  async searchUsers(
    searchTerm: string,
    currentUserId: string,
    limit = 20
  ): Promise<RowDataPacket[]> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.role,
        d.name as department_name,
        COALESCE(s.status, 'offline') as status
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN user_online_status s ON u.id = s.user_id
      WHERE u.id != ? 
        AND u.deleted_at IS NULL
        AND (
          u.full_name LIKE ? 
          OR u.email LIKE ?
          OR d.name LIKE ?
        )
      ORDER BY u.full_name
      LIMIT ?`,
      [
        currentUserId,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        limit,
      ]
    );

    return rows;
  }

  async getAllUsers(currentUserId?: string): Promise<RowDataPacket[]> {
    const query = currentUserId
      ? `SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role,
          d.name as department_name,
          COALESCE(s.status, 'offline') as status
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_online_status s ON u.id = s.user_id
        WHERE u.id != ? AND u.deleted_at IS NULL
        ORDER BY u.full_name`
      : `SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role,
          d.name as department_name,
          COALESCE(s.status, 'offline') as status
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_online_status s ON u.id = s.user_id
        WHERE u.deleted_at IS NULL
        ORDER BY u.full_name`;

    const [rows] = await dbPool.query<RowDataPacket[]>(
      query,
      currentUserId ? [currentUserId] : []
    );

    return rows;
  }

  async create(userData: {
    employee_id: string;
    email: string;
    password_hash: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    position?: string;
    department_id?: string;
    role: "Admin" | "Manager" | "Employee";
    status: "Active" | "Blocked" | "Pending";
    join_date?: Date;
  }): Promise<User> {
    const userId = crypto.randomUUID();

    await dbPool.query<ResultSetHeader>(
      `INSERT INTO users (
        id, employee_id, email, password_hash, full_name, phone,
        avatar_url, position, department_id, role, status, join_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        userData.employee_id,
        userData.email,
        userData.password_hash,
        userData.full_name,
        userData.phone || null,
        userData.avatar_url || null,
        userData.position || null,
        userData.department_id || null,
        userData.role,
        userData.status,
        userData.join_date || null,
      ]
    );

    const created = await this.findById(userId);
    if (!created) throw new Error("Failed to create user");
    return created;
  }

  async findAll(): Promise<UserWithDepartment[]> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        u.*,
        d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC`
    );
    return rows as UserWithDepartment[];
  }

  async update(id: string, userData: Partial<User>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.email) {
      updates.push("email = ?");
      values.push(userData.email);
    }
    if (userData.full_name) {
      updates.push("full_name = ?");
      values.push(userData.full_name);
    }
    if (userData.phone !== undefined) {
      updates.push("phone = ?");
      values.push(userData.phone);
    }
    if (userData.position !== undefined) {
      updates.push("position = ?");
      values.push(userData.position);
    }
    if (userData.department_id !== undefined) {
      updates.push("department_id = ?");
      values.push(userData.department_id);
    }
    if (userData.role) {
      updates.push("role = ?");
      values.push(userData.role);
    }
    if (userData.status) {
      updates.push("status = ?");
      values.push(userData.status);
    }
    if (userData.employee_id) {
      updates.push("employee_id = ?");
      values.push(userData.employee_id);
    }

    if (updates.length === 0) return;

    updates.push("updated_at = NOW()");
    values.push(id);

    await dbPool.query<ResultSetHeader>(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    await dbPool.query<ResultSetHeader>(
      "UPDATE users SET deleted_at = NOW() WHERE id = ?",
      [id]
    );
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await dbPool.query<ResultSetHeader>(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
      [newPasswordHash, id]
    );
  }

  /**
   * Get all users in a specific department
   * Used for sending notifications to department members
   * 
   * @param departmentId - The department ID
   * @returns Array of user IDs in the department
   */
  async findByDepartmentId(departmentId: string): Promise<string[]> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id FROM users 
       WHERE department_id = ? AND deleted_at IS NULL AND status = 'Active'`,
      [departmentId]
    );
    return rows.map(row => row.id);
  }

  /**
   * Get managers and admins in a specific department
   * Used for sending important notifications to department leadership
   * 
   * @param departmentId - The department ID
   * @returns Array of user IDs who are managers or admins in the department
   */
  async findManagersByDepartmentId(departmentId: string): Promise<string[]> {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id FROM users 
       WHERE department_id = ? 
       AND deleted_at IS NULL 
       AND status = 'Active'
       AND role IN ('Manager', 'Admin')`,
      [departmentId]
    );
    return rows.map(row => row.id);
  }

  async updateProfile(id: string, profileData: {
    full_name?: string;
    phone?: string;
    position?: string;
    avatar_url?: string;
  }): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (profileData.full_name) {
      updates.push("full_name = ?");
      values.push(profileData.full_name);
    }
    if (profileData.phone !== undefined) {
      updates.push("phone = ?");
      values.push(profileData.phone);
    }
    if (profileData.position !== undefined) {
      updates.push("position = ?");
      values.push(profileData.position);
    }
    if (profileData.avatar_url !== undefined) {
      updates.push("avatar_url = ?");
      values.push(profileData.avatar_url);
    }

    if (updates.length === 0) return;

    updates.push("updated_at = NOW()");
    values.push(id);

    await dbPool.query<ResultSetHeader>(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
  }
}
