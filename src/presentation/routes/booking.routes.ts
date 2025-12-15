import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createBookingSchema,
  updateBookingSchema,
  bookingIdParamSchema,
  approveBookingSchema,
  rejectBookingSchema,
  cancelBookingSchema,
  addParticipantSchema,
  removeParticipantSchema,
} from "../../application/validators/schemas/index.js";
import * as BookingController from "../controllers/BookingController.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ===================== ROOM BOOKINGS =====================
router.get("/", BookingController.getBookings);
router.get("/pending", BookingController.getPendingBookings);
router.get("/:id", validate(bookingIdParamSchema), BookingController.getBookingById);
router.post("/", validate(createBookingSchema), BookingController.createBooking);
router.put("/:id", validate(updateBookingSchema), BookingController.updateBooking);
router.delete("/:id", validate(bookingIdParamSchema), BookingController.deleteBooking);

// Approval workflow
router.put("/:id/approve", validate(approveBookingSchema), BookingController.approveBooking);
router.put("/:id/reject", validate(rejectBookingSchema), BookingController.rejectBooking);
router.put("/:id/cancel", validate(cancelBookingSchema), BookingController.cancelBooking);

// Participants
router.post("/:id/participants", validate(addParticipantSchema), BookingController.addParticipant);
router.delete("/:id/participants/:participantId", validate(removeParticipantSchema), BookingController.removeParticipant);

export default router;
