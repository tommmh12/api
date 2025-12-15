import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as FloorController from "../controllers/FloorController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ===================== FLOOR PLANS =====================
router.get("/", FloorController.getFloors);
router.get("/:id", FloorController.getFloorById);
router.post("/", FloorController.createFloor);
router.put("/:id", FloorController.updateFloor);
router.delete("/:id", FloorController.deleteFloor);

// Floor rooms
router.get("/:floorId/rooms", FloorController.getRoomsByFloor);

export default router;
