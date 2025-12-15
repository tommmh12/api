import { Request, Response } from "express";
import { DepartmentService } from "../../application/services/DepartmentService.js";
import { DepartmentRepository } from "../../infrastructure/repositories/DepartmentRepository.js";
import { auditLogger } from "../../utils/auditLogger.js";

const departmentRepository = new DepartmentRepository();
const departmentService = new DepartmentService(departmentRepository);

// Helper to get IP address from request
const getIpAddress = (req: Request): string => {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown";
};

export const getAllDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await departmentService.getAllDepartments();
    res.json(departments);
  } catch (error: any) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getDepartmentById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const department = await departmentService.getDepartmentById(id);

    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.json(department);
  } catch (error: any) {
    console.error("Error fetching department:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);

    const department = await departmentService.createDepartment(req.body);

    // Log audit trail
    await auditLogger.logDepartmentCreate(
      userId,
      department.id.toString(),
      department.name,
      ipAddress
    );

    res.status(201).json(department);
  } catch (error: any) {
    console.error("Error creating department:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);
    const id = req.params.id;

    // Get department info before update for logging
    const existingDept = await departmentService.getDepartmentById(id);
    if (!existingDept) {
      return res.status(404).json({ error: "Department not found" });
    }

    await departmentService.updateDepartment(id, req.body);

    // Log audit trail
    await auditLogger.logDepartmentUpdate(
      userId,
      id,
      existingDept.name,
      req.body, // changes
      ipAddress
    );

    res.json({ message: "Department updated successfully" });
  } catch (error: any) {
    console.error("Error updating department:", error);
    res.status(400).json({ error: error.message });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);
    const id = req.params.id;

    // Get department info before delete for logging
    const existingDept = await departmentService.getDepartmentById(id);
    if (!existingDept) {
      return res.status(404).json({ error: "Department not found" });
    }

    await departmentService.deleteDepartment(id);

    // Log audit trail
    await auditLogger.logDepartmentDelete(
      userId,
      id,
      existingDept.name,
      ipAddress
    );

    res.json({ message: "Department deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting department:", error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Check if a user is a manager of any department (excluding a specific dept)
 * GET /api/departments/check-manager/:userId?excludeDeptId=xxx
 */
export const checkUserIsManager = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const excludeDeptId = req.query.excludeDeptId as string | undefined;

    const result = await departmentService.checkUserIsManagerElsewhere(userId, excludeDeptId);

    res.json({
      isManager: result !== null,
      department: result
    });
  } catch (error: any) {
    console.error("Error checking manager status:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Clear the manager of a specific department
 * DELETE /api/departments/:id/manager
 */
export const clearDepartmentManager = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await departmentService.clearDepartmentManager(id);

    res.json({ message: "Manager cleared successfully" });
  } catch (error: any) {
    console.error("Error clearing manager:", error);
    res.status(400).json({ error: error.message });
  }
};
