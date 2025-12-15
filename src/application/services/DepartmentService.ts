import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";
import { Department } from "../../domain/entities/Department.js";
import { CacheService, CacheKeys, CacheTTL } from "../../infrastructure/cache/CacheService.js";

/**
 * Department Service with Cache-Aside Pattern
 * 
 * Implements Requirements 6.4:
 * - Cache frequently accessed, rarely changed department data
 * - Invalidate cache on write operations
 */
export class DepartmentService {
  private cache: CacheService;

  constructor(private departmentRepository: DepartmentRepository) {
    this.cache = CacheService.getInstance();
  }

  /**
   * Get all departments with caching
   * Cache key: departments:all
   * TTL: 10 minutes
   */
  async getAllDepartments(): Promise<Department[]> {
    return this.cache.getOrSet(
      CacheKeys.departments.all(),
      () => this.departmentRepository.findAll(),
      CacheTTL.DEPARTMENTS
    );
  }

  /**
   * Get department by ID with caching
   * Cache key: departments:{id}
   * TTL: 10 minutes
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    return this.cache.getOrSet(
      CacheKeys.departments.byId(id),
      () => this.departmentRepository.findById(id),
      CacheTTL.DEPARTMENTS
    );
  }

  /**
   * Create a new department
   * Invalidates: departments:all cache
   */
  async createDepartment(
    departmentData: Partial<Department>
  ): Promise<Department> {
    // Validate required fields
    if (!departmentData.name) {
      throw new Error("Name is required");
    }

    const department = await this.departmentRepository.create(departmentData);

    // Invalidate the all departments cache
    this.invalidateDepartmentCache();

    return department;
  }

  /**
   * Update an existing department
   * Invalidates: departments:all and departments:{id} cache
   */
  async updateDepartment(
    id: string,
    departmentData: Partial<Department>
  ): Promise<void> {
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new Error("Department not found");
    }

    // Update department
    await this.departmentRepository.update(id, departmentData);

    // If manager changed, update the new manager's department_id
    if (
      departmentData.managerId &&
      departmentData.managerId !== existing.managerId
    ) {
      // Clear old manager's department assignment if they were only in this dept as manager
      // (For now, we just update the new manager's department)

      // Update new manager's department_id to this department
      await this.departmentRepository.updateUserDepartment(
        departmentData.managerId,
        id
      );
    }

    // Invalidate cache for this department and the list
    this.invalidateDepartmentCache(id);
  }

  /**
   * Delete a department
   * Invalidates: departments:all and departments:{id} cache
   */
  async deleteDepartment(id: string): Promise<void> {
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new Error("Department not found");
    }

    await this.departmentRepository.delete(id);

    // Invalidate cache for this department and the list
    this.invalidateDepartmentCache(id);
  }

  /**
   * Check if user is manager of another department
   * Returns department info if true, null otherwise
   */
  async checkUserIsManagerElsewhere(
    userId: string,
    excludeDeptId?: string
  ): Promise<{ id: string; name: string } | null> {
    return this.departmentRepository.checkUserIsManagerElsewhere(
      userId,
      excludeDeptId
    );
  }

  /**
   * Clear the manager of a specific department
   * Invalidates: departments:all and departments:{id} cache
   */
  async clearDepartmentManager(deptId: string): Promise<void> {
    await this.departmentRepository.clearDepartmentManager(deptId);

    // Invalidate cache
    this.invalidateDepartmentCache(deptId);
  }

  /**
   * Invalidate department cache entries
   * @param id - Optional specific department ID to invalidate
   */
  private invalidateDepartmentCache(id?: string): void {
    // Always invalidate the all departments list
    this.cache.delete(CacheKeys.departments.all());

    // If specific ID provided, invalidate that entry too
    if (id) {
      this.cache.delete(CacheKeys.departments.byId(id));
    }
  }

  /**
   * Get manager's department statistics
   */
  async getManagerDashboardStats(userId: string) {
    try {
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const totalTasks = await this.departmentRepository.getDepartmentTaskCount(
        department.id
      );
      const completedTasks =
        await this.departmentRepository.getDepartmentCompletedTaskCount(
          department.id
        );
      const activeProjects =
        await this.departmentRepository.getDepartmentProjectCount(
          department.id
        );
      const completedProjects =
        await this.departmentRepository.getDepartmentCompletedProjectCount(
          department.id
        );
      const attendanceRate =
        await this.departmentRepository.getDepartmentAttendanceRate(
          department.id
        );
      const pendingLeave =
        await this.departmentRepository.getDepartmentLeaveCount(department.id);

      // Count active employees (online/working)
      const activeEmployees = employees.filter(
        (e: any) => e.status === "Active"
      ).length;

      return {
        totalEmployees: employees.length,
        activeEmployees,
        activeProjects,
        completedProjects,
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        overdueTasks: 0, // Will implement later
        averageAttendance: Math.round(attendanceRate * 100) || 0,
        pendingLeave,
        departmentName: department.name,
        departmentId: department.id,
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }

  /**
   * Get all employees in manager's department
   */
  async getDepartmentEmployees(userId: string) {
    try {
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );

      return employees.map((emp) => ({
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone,
        position: emp.position,
        avatar_url: emp.avatar_url,
        joinDate: emp.created_at,
        status: emp.status || "active",
      }));
    } catch (error) {
      console.error("Error getting department employees:", error);
      throw error;
    }
  }

  /**
   * Generate department report
   */
  async generateDepartmentReport(
    userId: string,
    period: string,
    startDate?: string,
    endDate?: string
  ) {
    try {
      const department =
        await this.departmentRepository.findDepartmentByManagerId(userId);
      if (!department) {
        throw new Error("Manager department not found");
      }

      const employees = await this.departmentRepository.getDepartmentEmployees(
        department.id
      );
      const tasks = await this.departmentRepository.getDepartmentTasks(
        department.id,
        startDate,
        endDate
      );

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(
        (t) => t.status === "completed"
      ).length;
      const completionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Get projects associated with department
      const projects = await this.departmentRepository.getDepartmentProjects(
        department.id
      );
      const activeProjects = projects.filter(
        (p) => p.status !== "completed" && p.status !== "cancelled"
      ).length;

      // Build employee performance data
      const employeePerformance = employees.map((emp) => {
        const empTasks = tasks.filter((t) => t.assigned_to === emp.id);
        const empCompleted = empTasks.filter(
          (t) => t.status === "completed"
        ).length;
        return {
          id: emp.id,
          name: emp.full_name,
          position: emp.position || "Nhân viên",
          tasksCompleted: empCompleted,
          tasksTotal: empTasks.length,
          attendanceRate: 95, // Default value, could be calculated
          rating:
            empTasks.length > 0
              ? Math.round((empCompleted / empTasks.length) * 5 * 10) / 10
              : 0,
        };
      });

      // Build project status data
      const projectStatus = projects.slice(0, 5).map((proj) => ({
        id: proj.id,
        name: proj.name,
        status: proj.status || "In Progress",
        progress: proj.progress || 0,
        deadline: proj.end_date || proj.endDate || "N/A",
        members: proj.memberCount || 0,
      }));

      const attendance =
        await this.departmentRepository.getDepartmentAttendanceDetails(
          department.id,
          startDate,
          endDate
        );

      const attendanceRate =
        attendance.length > 0
          ? Math.round(
            (attendance.filter((a) => a.status === "present").length /
              attendance.length) *
            100
          )
          : 0;

      return {
        departmentName: department.name,
        period: startDate && endDate ? `${startDate} - ${endDate}` : period,
        generatedAt: new Date().toLocaleString("vi-VN"),
        summary: {
          totalEmployees: employees.length,
          activeProjects,
          completedTasks,
          totalTasks,
          attendanceRate,
          avgWorkHours: 8.0,
        },
        employeePerformance,
        projectStatus,
      };
    } catch (error) {
      console.error("Error generating report:", error);
      throw error;
    }
  }
}
