import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as DepartmentController from "../controllers/DepartmentController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/", DepartmentController.getAllDepartments);
router.get("/check-manager/:userId", DepartmentController.checkUserIsManager);
router.get("/:id", DepartmentController.getDepartmentById);
router.post("/", DepartmentController.createDepartment);
router.put("/:id", DepartmentController.updateDepartment);
router.delete("/:id/manager", DepartmentController.clearDepartmentManager);
router.delete("/:id", DepartmentController.deleteDepartment);

export default router;
