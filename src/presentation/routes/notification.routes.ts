import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { enhancedNotificationService } from "../../application/services/EnhancedNotificationService.js";
import { logger } from "../../infrastructure/logging/index.js";

const router = Router();

router.use(authMiddleware);

// Get notifications for the authenticated user
router.get("/", async (req, res) => {
  try {
    const userId = (req as any).user?.userId || req.query.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { limit, offset, page, unreadOnly, category, type, is_read, search } =
      req.query;

    // Calculate offset from page if provided
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const offsetNum = offset
      ? parseInt(offset as string)
      : (pageNum - 1) * limitNum;

    // Determine unreadOnly from is_read param
    let unreadOnlyFlag = unreadOnly === "true";
    if (is_read === "false") unreadOnlyFlag = true;
    if (is_read === "true") unreadOnlyFlag = false;

    const result = await enhancedNotificationService.getUserNotifications(
      userId,
      {
        limit: limitNum,
        offset: offsetNum,
        unreadOnly: unreadOnlyFlag,
        category: category as string,
        type: type as string,
        search: search as string,
      }
    );

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
        unreadCount: result.unreadCount,
      },
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting notifications", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get notification statistics
router.get("/stats", async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const stats = await enhancedNotificationService.getNotificationStats(
      userId
    );
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's notification settings
router.get("/settings", async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const settings = await enhancedNotificationService.getSettings(userId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error getting notification settings", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user's notification settings
router.put("/settings", async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const settings = await enhancedNotificationService.updateSettings(
      userId,
      req.body
    );
    res.json({
      success: true,
      data: settings,
      message: "Cài đặt thông báo đã được cập nhật",
    });
  } catch (error: any) {
    const reqLogger = req.logger || logger;
    reqLogger.error("Error updating notification settings", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark single notification as read
router.put("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    await enhancedNotificationService.markAsRead(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all notifications as read
router.put("/read-all", async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { category } = req.body;
    const count = await enhancedNotificationService.markAllAsRead(
      userId,
      category
    );
    res.json({
      success: true,
      message: `Đã đánh dấu ${count} thông báo đã đọc`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete single notification
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await enhancedNotificationService.deleteNotification(id);
    res.json({ success: true, message: "Đã xóa thông báo" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all read notifications
router.delete("/", async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const count = await enhancedNotificationService.deleteAllRead(userId);
    res.json({ success: true, message: `Đã xóa ${count} thông báo đã đọc` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
