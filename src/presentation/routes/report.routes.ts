import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as ReportController from "../controllers/ReportController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/project/:projectId", ReportController.getReportsByProject);
router.get("/:id", ReportController.getReportById);
router.post("/", ReportController.createReport);
router.put("/:id/review", ReportController.reviewReport);
router.delete("/:id", ReportController.deleteReport);

export default router;
