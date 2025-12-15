import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { DepartmentService } from "../../application/services/DepartmentService.js";
import { ManagerTaskService } from "../../application/services/ManagerTaskService.js";
import { AttendanceService } from "../../application/services/AttendanceService.js";
import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";
import { TaskRepository } from "../../infrastructure/repositories/TaskRepository.js";
import { AttendanceRepository } from "../../infrastructure/repositories/AttendanceRepository.js";

const router = Router();

// Initialize repositories and services
const departmentRepository = new DepartmentRepository();
const taskRepository = new TaskRepository();
const attendanceRepository = new AttendanceRepository();

const departmentService = new DepartmentService(departmentRepository);
const taskService = new ManagerTaskService(
  taskRepository,
  departmentRepository
);
const attendanceService = new AttendanceService(
  attendanceRepository,
  departmentRepository
);

// All manager routes require authentication
router.use(authMiddleware);

/**
 * GET /api/manager/stats
 * Get dashboard statistics for manager's department
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const stats = await departmentService.getManagerDashboardStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê",
    });
  }
});

/**
 * GET /api/manager/employees
 * Get all employees in manager's department
 */
router.get("/employees", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const employees = await departmentService.getDepartmentEmployees(userId);

    res.json({
      success: true,
      data: employees,
    });
  } catch (error: any) {
    console.error("Error fetching employees:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách nhân viên",
    });
  }
});

/**
 * GET /api/manager/tasks
 * Get all tasks assigned to manager and tasks for employees
 */
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const status = req.query.status as string;
    const tasks = await taskService.getManagerTasks(userId, status);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách công việc",
    });
  }
});

/**
 * POST /api/manager/tasks
 * Create and assign task to employee
 */
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, assigned_to, due_date, priority, checklist } =
      req.body;

    const task = await taskService.createManagerTask(userId, {
      title,
      description,
      assigned_to,
      due_date,
      priority: priority || "medium",
      checklist,
    });

    res.json({
      success: true,
      data: task,
      message: "Công việc được tạo thành công",
    });
  } catch (error: any) {
    console.error("Error creating task:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo công việc",
    });
  }
});

/**
 * GET /api/manager/attendance
 * Get attendance records for department
 */
router.get("/attendance", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const date = req.query.date as string;
    const view = (req.query.view as string) || "daily";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const records = await attendanceService.getDepartmentAttendance(
      userId,
      view,
      date,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy dữ liệu điểm danh",
    });
  }
});

/**
 * GET /api/manager/reports
 * Get department reports
 */
router.get("/reports", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const report = await departmentService.generateDepartmentReport(
      userId,
      period,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo báo cáo",
    });
  }
});

/**
 * PUT /api/manager/tasks/:id/status
 * Update task status
 */
router.put("/tasks/:id/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const taskId = req.params.id;
    const { status, progress } = req.body;

    const result = await taskService.updateTaskStatus(
      userId,
      taskId,
      status,
      progress
    );

    res.json({
      success: true,
      data: result,
      message: "Cập nhật trạng thái thành công",
    });
  } catch (error: any) {
    console.error("Error updating task status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật trạng thái",
    });
  }
});

/**
 * POST /api/manager/tasks/:id/comments
 * Add comment to task
 */
router.post("/tasks/:id/comments", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const taskId = req.params.id;
    const { comment } = req.body;

    const result = await taskService.addTaskComment(userId, taskId, comment);

    res.json({
      success: true,
      data: result,
      message: "Thêm bình luận thành công",
    });
  } catch (error: any) {
    console.error("Error adding task comment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi thêm bình luận",
    });
  }
});

/**
 * PUT /api/manager/tasks/:id/checklist
 * Update task checklist
 */
router.put("/tasks/:id/checklist", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const taskId = req.params.id;
    const { checklist } = req.body;

    const result = await taskService.updateTaskChecklist(
      userId,
      taskId,
      checklist
    );

    res.json({
      success: true,
      data: result,
      message: "Cập nhật checklist thành công",
    });
  } catch (error: any) {
    console.error("Error updating task checklist:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật checklist",
    });
  }
});

/**
 * POST /api/manager/attendance/checkin
 * Check-in employee
 */
router.post("/attendance/checkin", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { employeeId, checkInTime } = req.body;

    const result = await attendanceService.checkInEmployee(
      userId,
      employeeId,
      checkInTime
    );

    res.json({
      success: true,
      data: result,
      message: "Check-in thành công",
    });
  } catch (error: any) {
    console.error("Error checking in employee:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi check-in",
    });
  }
});

/**
 * POST /api/manager/attendance/checkout
 * Check-out employee
 */
router.post("/attendance/checkout", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { employeeId, checkOutTime } = req.body;

    const result = await attendanceService.checkOutEmployee(
      userId,
      employeeId,
      checkOutTime
    );

    res.json({
      success: true,
      data: result,
      message: "Check-out thành công",
    });
  } catch (error: any) {
    console.error("Error checking out employee:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi check-out",
    });
  }
});

/**
 * POST /api/manager/attendance/mark
 * Mark attendance manually
 */
router.post("/attendance/mark", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { employeeId, date, status } = req.body;

    const result = await attendanceService.markAttendance(
      userId,
      employeeId,
      date,
      status
    );

    res.json({
      success: true,
      data: result,
      message: "Đánh dấu điểm danh thành công",
    });
  } catch (error: any) {
    console.error("Error marking attendance:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi đánh dấu điểm danh",
    });
  }
});

/**
 * GET /api/manager/attendance/stats
 * Get attendance statistics
 */
router.get("/attendance/stats", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const month = req.query.month as string;

    const stats = await attendanceService.getDepartmentAttendanceStats(
      userId,
      month
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error getting attendance stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê điểm danh",
    });
  }
});

/**
 * GET /api/manager/reports/generate
 * Generate department report
 */
router.get("/reports/generate", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const reportType = (req.query.type as string) || "monthly";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const report = await departmentService.generateDepartmentReport(
      userId,
      reportType,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo báo cáo",
    });
  }
});

/**
 * GET /api/manager/reports/export
 * Export department report to PDF/Excel/CSV
 */
router.get("/reports/export", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const format = (req.query.format as string) || "pdf";
    const reportType = (req.query.type as string) || "monthly";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Generate report data
    const report = await departmentService.generateDepartmentReport(
      userId,
      reportType,
      startDate,
      endDate
    );

    // For now, return JSON with message that export is being developed
    // In production, you would use libraries like pdfkit, exceljs, etc.
    if (format === "csv") {
      const csvContent = generateCSV(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=bao-cao-${reportType}-${startDate}.csv`
      );
      return res.send(csvContent);
    }

    res.status(501).json({
      success: false,
      message: `Export to ${format.toUpperCase()} is under development`,
    });
  } catch (error: any) {
    console.error("Error exporting report:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi xuất báo cáo",
    });
  }
});

// Helper function to generate CSV
function generateCSV(report: any): string {
  const lines: string[] = [];

  // Header
  lines.push(`Báo cáo phòng ban: ${report.departmentName}`);
  lines.push(`Kỳ báo cáo: ${report.period}`);
  lines.push(`Ngày tạo: ${report.generatedAt}`);
  lines.push("");

  // Summary
  lines.push("Tổng quan");
  lines.push(`Tổng nhân viên,${report.summary.totalEmployees}`);
  lines.push(`Dự án đang thực hiện,${report.summary.activeProjects}`);
  lines.push(
    `Task hoàn thành,${report.summary.completedTasks}/${report.summary.totalTasks}`
  );
  lines.push(`Tỷ lệ chuyên cần,${report.summary.attendanceRate}%`);
  lines.push("");

  // Employee Performance
  lines.push("Hiệu suất nhân viên");
  lines.push("Tên,Vị trí,Task hoàn thành,Tổng task,Chuyên cần,Đánh giá");
  for (const emp of report.employeePerformance || []) {
    lines.push(
      `${emp.name},${emp.position},${emp.tasksCompleted},${emp.tasksTotal},${emp.attendanceRate}%,${emp.rating}`
    );
  }
  lines.push("");

  // Project Status
  lines.push("Tình trạng dự án");
  lines.push("Tên dự án,Trạng thái,Tiến độ,Deadline,Thành viên");
  for (const proj of report.projectStatus || []) {
    lines.push(
      `${proj.name},${proj.status},${proj.progress}%,${proj.deadline},${proj.members}`
    );
  }

  return lines.join("\n");
}

export default router;
