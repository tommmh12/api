import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getActivityLogs,
  getActivityLogById,
  getActivityStats,
  getActivityTypes,
  deleteActivityLog,
  deleteMultipleActivityLogs,
  exportActivityLogs,
} from "../controllers/ActivityLogController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/activity-logs - Get all activity logs with filters
router.get("/", getActivityLogs);

// GET /api/activity-logs/stats - Get statistics
router.get("/stats", getActivityStats);

// GET /api/activity-logs/types - Get all activity types
router.get("/types", getActivityTypes);

// GET /api/activity-logs/export - Export logs to CSV
router.get("/export", exportActivityLogs);

// GET /api/activity-logs/:id - Get single log detail
router.get("/:id", getActivityLogById);

// DELETE /api/activity-logs/:id - Delete single log
router.delete("/:id", deleteActivityLog);

// POST /api/activity-logs/delete-multiple - Delete multiple logs
router.post("/delete-multiple", deleteMultipleActivityLogs);

export default router;
