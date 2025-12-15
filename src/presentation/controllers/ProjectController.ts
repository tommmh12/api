import { Request, Response } from "express";
import { ProjectService } from "../../application/services/ProjectService.js";
import { auditLogger } from "../../utils/auditLogger.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const projectService = new ProjectService();
const logger = createLogger("ProjectController");

// Helper to get IP address from request
const getIpAddress = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await projectService.getAllProjects();
    res.json({ success: true, data: projects });
  } catch (error: any) {
    logger.error("Error getting projects", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dự án",
    });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await projectService.getProjectWithDetails(id);
    res.json({ success: true, data: project });
  } catch (error: any) {
    logger.error("Error getting project", error, { projectId: req.params.id });
    res.status(404).json({
      success: false,
      message: error.message || "Không tìm thấy dự án",
    });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);
    const project = await projectService.createProject(req.body, userId);

    // Log project creation
    await auditLogger.logProjectCreate(
      userId,
      (project as any).id,
      (project as any).name,
      ipAddress
    );

    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    logger.error("Error creating project", error);
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo dự án",
    });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);

    // Get existing project for logging
    const existingProject = await projectService.getProjectWithDetails(id);
    const project = await projectService.updateProject(id, req.body);

    // Log project update
    await auditLogger.logProjectUpdate(
      userId,
      id,
      (existingProject as any)?.name || (project as any).name,
      req.body,
      ipAddress
    );

    res.json({ success: true, data: project });
  } catch (error: any) {
    logger.error("Error updating project", error, { projectId: req.params.id });
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật dự án",
    });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const ipAddress = getIpAddress(req);

    // Get project info before delete
    const existingProject = await projectService.getProjectWithDetails(id);
    await projectService.deleteProject(id);

    // Log project deletion
    await auditLogger.logProjectDelete(
      userId,
      id,
      (existingProject as any)?.name || "Unknown",
      ipAddress
    );

    res.json({ success: true, message: "Đã xóa dự án thành công" });
  } catch (error: any) {
    logger.error("Error deleting project", error, { projectId: req.params.id });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa dự án",
    });
  }
};

export const addMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId: memberId, role } = req.body;

    if (!memberId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const members = await projectService.addMember(id, memberId, role);
    res.json({ success: true, data: members });
  } catch (error: any) {
    logger.error("Error adding member", error, { projectId: req.params.id, memberId: req.body.userId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm thành viên",
    });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { id, userId: memberId } = req.params;
    await projectService.removeMember(id, memberId);
    res.json({ success: true, message: "Đã xóa thành viên" });
  } catch (error: any) {
    logger.error("Error removing member", error, { projectId: req.params.id, memberId: req.params.userId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa thành viên",
    });
  }
};

export const generateProjectCode = async (req: Request, res: Response) => {
  try {
    const code = await projectService.generateProjectCode();
    res.json({ success: true, code });
  } catch (error: any) {
    logger.error("Error generating project code", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo mã dự án",
    });
  }
};

export const getMyProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const projects = await projectService.getProjectsByUserId(userId);
    res.json({ success: true, data: projects });
  } catch (error: any) {
    logger.error("Error getting my projects", error, { userId: (req as any).user?.userId });
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách dự án của bạn",
    });
  }
};
