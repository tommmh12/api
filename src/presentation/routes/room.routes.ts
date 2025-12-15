import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as FloorController from "../controllers/FloorController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ===================== MEETING ROOMS =====================
router.get("/", FloorController.getRooms);
router.get("/availability", FloorController.getRoomAvailability);
router.get("/check-availability", FloorController.checkRoomAvailability);
router.get("/:id", FloorController.getRoomById);
router.post("/", FloorController.createRoom);
router.put("/:id", FloorController.updateRoom);
router.delete("/:id", FloorController.deleteRoom);

export default router;
