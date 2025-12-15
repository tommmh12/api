import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.use(authMiddleware);

router.get("/overview", dashboardController.getOverview);
router.get("/stats", dashboardController.getStats);
router.get("/employee", dashboardController.getEmployeeDashboard);

export default router;

