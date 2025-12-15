import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../application/services/AuthService.js";
import { auditLogger } from "../../utils/auditLogger.js";
import { securityAuditService } from "../../application/services/SecurityAuditService.js";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      console.log("[AuthController] Login attempt for email:", email);

      // Validation
      if (!email || !password) {
        console.log("[AuthController] Missing email or password");
        res.status(400).json({
          success: false,
          message: "Email và mật khẩu là bắt buộc",
        });
        return;
      }

      // Authenticate with session metadata (Requirements 1.4)
      const authResponse = await this.authService.login(
        {
          email,
          password,
          rememberMe: rememberMe || false,
        },
        {
          ipAddress,
          userAgent,
        }
      );

      // Log successful login (both activity log and security audit)
      auditLogger.logLogin(
        authResponse.user.id,
        authResponse.user.email,
        ipAddress,
        userAgent,
        true
      );

      // Security audit log (Requirements 3.1)
      const correlationId = (req as any).correlationId;
      securityAuditService.logLogin({
        userId: authResponse.user.id,
        userEmail: authResponse.user.email,
        ipAddress,
        userAgent,
        correlationId,
      });

      res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        data: authResponse,
      });
    } catch (error) {
      // Log failed login attempt
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const correlationId = (req as any).correlationId;
      
      auditLogger.logLogin(
        "unknown",
        req.body.email || "unknown",
        ipAddress,
        userAgent,
        false
      );

      // Security audit log for failed login (Requirements 3.1)
      securityAuditService.logLoginFailed({
        attemptedEmail: req.body.email || "unknown",
        ipAddress,
        userAgent,
        correlationId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof Error) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
      } else {
        next(error);
      }
    }
  };

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const user = (req as any).user;

      if (token) {
        // Pass userId for token blacklisting (Requirements 1.3)
        await this.authService.logout(token, user?.userId);
      }

      // Log logout
      if (user) {
        auditLogger.logLogout(user.id, user.email);
        
        // Security audit log (Requirements 3.1)
        const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
        const correlationId = (req as any).correlationId;
        securityAuditService.logLogout({
          userId: user.id,
          userEmail: user.email,
          ipAddress,
          correlationId,
        });
      }

      res.status(200).json({
        success: true,
        message: "Đăng xuất thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
        return;
      }

      const user = await this.authService.verifyToken(token);

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Token đã hết hạn hoặc không hợp lệ",
        });
        return;
      }

      const { password_hash, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        data: userWithoutPassword,
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Token không hợp lệ",
        });
        return;
      }

      const user = await this.authService.verifyToken(token);

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Phiên đăng nhập đã hết hạn",
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới",
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: "Mật khẩu mới phải có ít nhất 8 ký tự",
        });
        return;
      }

      // Change password via AuthService
      // Pass the current token so it can be invalidated (Requirements 1.3)
      await this.authService.changePassword(
        user.id,
        currentPassword,
        newPassword,
        token  // Token will be invalidated after password change
      );

      // Log password change
      auditLogger.logPasswordChange(user.id, user.email);

      // Security audit log (Requirements 3.1)
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const correlationId = (req as any).correlationId;
      securityAuditService.logPasswordChange({
        userId: user.id,
        userEmail: user.email,
        ipAddress,
        correlationId,
        success: true,
      });

      res.status(200).json({
        success: true,
        message: "Đổi mật khẩu thành công",
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
      } else {
        next(error);
      }
    }
  };
}
