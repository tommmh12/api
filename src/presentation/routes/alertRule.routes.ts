import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getAlertRules,
  getAlertRuleById,
  createAlertRule,
  updateAlertRule,
  toggleAlertRule,
  deleteAlertRule,
  getAlertStats,
  getAlertHistory,
  testAlertRule,
  triggerAlertCheck,
  getMyAlerts,
  getDepartmentsForAlert,
  getUsersForAlert,
} from "../controllers/AlertRuleController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/alert-rules/my-alerts - Get alerts for current user
router.get("/my-alerts", getMyAlerts);

// GET /api/alert-rules/departments - Get departments for dropdown
router.get("/departments", getDepartmentsForAlert);

// GET /api/alert-rules/users - Get users for dropdown
router.get("/users", getUsersForAlert);

// GET /api/alert-rules/stats - Get alert statistics
router.get("/stats", getAlertStats);

// GET /api/alert-rules/history - Get alert history
router.get("/history", getAlertHistory);

// POST /api/alert-rules/trigger-check - Manually trigger alert check
router.post("/trigger-check", triggerAlertCheck);

// GET /api/alert-rules - Get all alert rules
router.get("/", getAlertRules);

// GET /api/alert-rules/:id - Get single rule
router.get("/:id", getAlertRuleById);

// POST /api/alert-rules - Create new rule
router.post("/", createAlertRule);

// POST /api/alert-rules/:id/test - Test a specific rule
router.post("/:id/test", testAlertRule);

// PUT /api/alert-rules/:id - Update rule
router.put("/:id", updateAlertRule);

// PATCH /api/alert-rules/:id/toggle - Toggle enable/disable
router.patch("/:id/toggle", toggleAlertRule);

// DELETE /api/alert-rules/:id - Delete rule
router.delete("/:id", deleteAlertRule);

export default router;
