import { Request, Response } from "express";
import { UserService } from "../../application/services/UserService.js";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { auditLogger } from "../../utils/auditLogger.js";
import { createLogger } from "../../infrastructure/logging/index.js";
import { securityAuditService } from "../../application/services/SecurityAuditService.js";

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const logger = createLogger("UserController");

// Helper to get IP address from request
const getIpAddress = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);

    const result = await userService.createUser({
      employee_id: req.body.employee_id,
      email: req.body.email,
      password: req.body.password, // Optional - will be auto-generated if not provided
      full_name: req.body.full_name,
      phone: req.body.phone,
      position: req.body.position,
      department_id: req.body.department_id,
      role: req.body.role || "Employee",
      status: req.body.status || "Active",
      join_date: req.body.join_date ? new Date(req.body.join_date) : undefined,
    });

    // Log audit trail
    await auditLogger.logUserCreate(
      userId,
      result.user.id,
      result.user.full_name,
      ipAddress
    );

    res.status(201).json({
      success: true,
      data: result.user,
      message: "User created successfully. Welcome email sent.",
      tempPassword: result.password, // Return temporary password
    });
  } catch (error: any) {
    logger.error("Error creating user", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to create user",
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error: any) {
    logger.error("Error fetching users", error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error: any) {
    logger.error("Error fetching user", error, { userId: req.params.id });
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);
    const targetUserId = req.params.id;
    const correlationId = (req as any).correlationId;

    // Get user info before update for logging
    const existingUser = await userService.getUserById(targetUserId);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldRole = existingUser.role;
    await userService.updateUser(targetUserId, req.body);

    // Log audit trail
    await auditLogger.logUserUpdate(
      userId,
      targetUserId,
      existingUser.full_name,
      req.body, // changes
      ipAddress
    );

    // Security audit log for permission/role changes (Requirements 3.1)
    if (req.body.role && req.body.role !== oldRole) {
      securityAuditService.logPermissionChange({
        userId: userId,
        targetUserId: targetUserId,
        targetUserEmail: existingUser.email,
        oldRole: oldRole,
        newRole: req.body.role,
        ipAddress,
        correlationId,
      });
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error: any) {
    logger.error("Error updating user", error, { userId: req.params.id });
    res.status(400).json({ error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ipAddress = getIpAddress(req);
    const targetUserId = req.params.id;

    // Get user info before delete for logging
    const existingUser = await userService.getUserById(targetUserId);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await userService.deleteUser(targetUserId);

    // Log audit trail
    await auditLogger.logUserDelete(
      userId,
      targetUserId,
      existingUser.full_name,
      ipAddress
    );

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    logger.error("Error deleting user", error, { userId: req.params.id });
    res.status(400).json({ error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { full_name, phone, position, avatar_url } = req.body;

    await userRepository.updateProfile(userId, {
      full_name,
      phone,
      position,
      avatar_url,
    });

    // Get updated user
    const updatedUser = await userService.getUserById(userId);

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error: any) {
    logger.error("Error updating profile", error, { userId: (req as any).user?.userId });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error("Error getting profile", error, { userId: (req as any).user?.userId });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
