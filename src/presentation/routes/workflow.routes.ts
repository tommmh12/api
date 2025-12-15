import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as WorkflowController from "../controllers/WorkflowController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/", WorkflowController.getWorkflows);
router.get("/:id", WorkflowController.getWorkflowById);
router.post("/", WorkflowController.createWorkflow);
router.put("/:id", WorkflowController.updateWorkflow);
router.delete("/:id", WorkflowController.deleteWorkflow);

export default router;
