import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tokenBlacklistService } from "../../application/services/TokenBlacklistService.js";
import { sessionValidationService } from "../../application/services/SessionValidationService.js";
import { createLogger } from "../../infrastructure/logging/StructuredLogger.js";
import { dbPool } from "../../infrastructure/database/connection.js";

const logger = createLogger("AuthMiddleware");

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      sessionMetadataMismatch?: boolean;
    }
  }
}

/**
 * Authentication middleware
 * 
 * Validates JWT tokens and checks against the token blacklist.
 * Also validates session metadata consistency (Requirements 1.4).
 * 
 * Implements Requirements 1.3:
 * - Check blacklist on token validation
 * 
 * Implements Requirements 1.4:
 * - Validate session consistency on subsequent requests
 * - Warn on metadata mismatch (don't block initially)
 * 
 * Properties validated:
 * - Property 3: Token Invalidation on Logout - rejected tokens return 401
 * - Property 4: Token Invalidation on Password Change - rejected tokens return 401
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const token = authHeader.substring(7);
    
    // Validate JWT_SECRET is properly configured
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error("FATAL: JWT_SECRET is not properly configured. Length:", jwtSecret?.length || 0);
      return res.status(500).json({
        success: false,
        message: "Lỗi cấu hình hệ thống",
      });
    }

    // Check if token is blacklisted (Requirements 1.3)
    let isBlacklisted = false;
    try {
      isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
    } catch (blacklistError) {
      console.error("Blacklist check error:", blacklistError);
      // Continue without blacklist check if it fails
    }
    
    if (isBlacklisted) {
      console.log("Token is blacklisted");
      return res.status(401).json({
        success: false,
        message: "Token đã bị vô hiệu hóa",
      });
    }

    // Verify JWT signature and expiration
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      console.log("JWT verified successfully for user:", decoded.email);
    } catch (jwtError: any) {
      console.error("JWT verify error:", jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }
    req.user = decoded;

    // Validate session metadata consistency (Requirements 1.4)
    // This runs in warn mode - logs mismatches but doesn't block
    const currentIp = req.ip || req.socket.remoteAddress || "unknown";
    const currentUserAgent = req.headers["user-agent"] || "unknown";
    
    const validationResult = await sessionValidationService.validateSessionMetadata(
      decoded.userId,
      token,
      currentIp,
      currentUserAgent
    );

    // Store mismatch flag on request for potential use by other middleware/handlers
    req.sessionMetadataMismatch = validationResult.hasMetadataMismatch;

    if (validationResult.hasMetadataMismatch) {
      // Log for security monitoring but don't block (warn mode per Requirements 1.4)
      logger.warn("Session metadata mismatch - request allowed in warn mode", {
        userId: decoded.userId,
        correlationId: (req as any).correlationId,
        mismatchDetails: validationResult.mismatchDetails ? {
          ipMismatch: validationResult.mismatchDetails.ipMismatch,
          userAgentMismatch: validationResult.mismatchDetails.userAgentMismatch,
        } : undefined,
      });
    }

    next();
  } catch (error) {
    logger.error("Auth middleware error", error as Error, {
      path: req.path,
      hasAuthHeader: !!req.headers.authorization,
    });
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

/**
 * Role-based access control middleware
 * 
 * Checks if the authenticated user has one of the required roles.
 * Must be used after authMiddleware.
 * 
 * @param allowedRoles - Array of role names that are allowed access
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Chưa xác thực",
        });
      }

      // Fetch user from database to get current role
      const [rows] = await dbPool.query(
        "SELECT role FROM users WHERE id = ?",
        [req.user.userId]
      );

      const users = rows as Array<{ role: string }>;
      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Người dùng không tồn tại",
        });
      }

      const userRole = users[0].role.toLowerCase();
      const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

      if (!normalizedAllowedRoles.includes(userRole)) {
        logger.warn("Access denied - insufficient role", {
          userId: req.user.userId,
          userRole,
          requiredRoles: allowedRoles,
          path: req.path,
        });

        return res.status(403).json({
          success: false,
          message: "Không có quyền truy cập",
        });
      }

      next();
    } catch (error) {
      logger.error("Role check failed", error as Error);
      return res.status(500).json({
        success: false,
        message: "Lỗi kiểm tra quyền truy cập",
      });
    }
  };
};
