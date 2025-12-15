import { Router, Request, Response } from "express";
import {
  commentImageUpload,
  getImageUrl,
  avatarUpload,
  getAvatarUrl,
  forumImageUpload,
  getForumImageUrl,
} from "../../application/services/uploadService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  validateImageUpload,
  validateAvatarUpload,
} from "../middlewares/fileValidation.middleware.js";
import { UserRepository } from "../../infrastructure/repositories/UserRepository.js";
import { logger } from "../../infrastructure/logging/index.js";

const router = Router();
const userRepository = new UserRepository();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/upload/comment-image
 * Upload an image for use in comments
 * Validates file content using magic byte inspection
 */
router.post(
  "/comment-image",
  commentImageUpload.single("image"),
  validateImageUpload,
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Không có file được upload",
        });
        return;
      }

      const imageUrl = getImageUrl(req.file.filename);

      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
        },
      });
    } catch (error: any) {
      const reqLogger = req.logger || logger;
      reqLogger.error("Upload error", error, { type: 'comment-image' });
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi upload file",
      });
    }
  }
);

/**
 * POST /api/upload/avatar
 * Upload avatar for current user and update profile
 * Validates file content using magic byte inspection
 */
router.post(
  "/avatar",
  avatarUpload.single("avatar"),
  validateAvatarUpload,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Không có file được upload",
        });
        return;
      }

      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const avatarUrl = getAvatarUrl(req.file.filename);
      const fullAvatarUrl = `http://localhost:5000${avatarUrl}`;

      // Update user's avatar_url in database
      await userRepository.updateProfile(userId, {
        avatar_url: fullAvatarUrl,
      });

      res.json({
        success: true,
        message: "Upload avatar thành công",
        data: {
          url: fullAvatarUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
        },
      });
    } catch (error: any) {
      const reqLogger = req.logger || logger;
      reqLogger.error("Avatar upload error", error, { type: 'avatar' });
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi upload avatar",
      });
    }
  }
);

/**
 * POST /api/upload/forum-image
 * Upload an image for use in forum posts
 * Validates file content using magic byte inspection
 */
router.post(
  "/forum-image",
  forumImageUpload.single("image"),
  validateImageUpload,
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Không có file được upload",
        });
        return;
      }

      const imageUrl = getForumImageUrl(req.file.filename);
      const fullImageUrl = `http://localhost:5000${imageUrl}`;

      res.json({
        success: true,
        data: {
          url: fullImageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
        },
      });
    } catch (error: any) {
      const reqLogger = req.logger || logger;
      reqLogger.error("Forum image upload error", error, { type: 'forum-image' });
      res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi upload ảnh",
      });
    }
  }
);

export default router;
