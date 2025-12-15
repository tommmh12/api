import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as SettingsController from "../controllers/SettingsController.js";

const router = Router();

// Task settings require authentication
router.get("/task", authMiddleware, SettingsController.getTaskSettings);

// Email configuration routes (no auth for now - admin only in production)
router.get("/email", SettingsController.getEmailConfig);
router.put("/email", SettingsController.updateEmailConfig);
router.post("/email/test", SettingsController.testEmail);

export default router;
