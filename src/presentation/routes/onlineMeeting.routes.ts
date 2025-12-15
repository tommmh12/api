import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as OnlineMeetingController from "../controllers/OnlineMeetingController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ===================== ONLINE MEETINGS =====================

// Create new meeting
router.post("/", OnlineMeetingController.createMeeting);

// Get all meetings accessible by user
router.get("/", OnlineMeetingController.getMeetings);

// Get meeting by ID
router.get("/:id", OnlineMeetingController.getMeetingById);

// Get Jitsi join token (validates access)
router.get("/:id/join-token", OnlineMeetingController.getJoinToken);

// Add participants to meeting
router.post("/:id/participants", OnlineMeetingController.addParticipants);

// Remove participant from meeting
router.delete("/:id/participants/:userId", OnlineMeetingController.removeParticipant);

// Update meeting status
router.patch("/:id/status", OnlineMeetingController.updateMeetingStatus);

// Delete meeting
router.delete("/:id", OnlineMeetingController.deleteMeeting);

export default router;
