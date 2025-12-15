import { Request, Response } from "express";
import { BookingRepository } from "../../infrastructure/repositories/BookingRepository.js";
import { FloorRepository } from "../../infrastructure/repositories/FloorRepository.js";
import { notificationService } from "../../application/services/NotificationService.js";
import { auditLogger } from "../../utils/auditLogger.js";

const bookingRepository = new BookingRepository();
const floorRepository = new FloorRepository();

// Helper to get IP address from request
const getIpAddress = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

// ===================== BOOKINGS =====================

export const getBookings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { status, date, startDate, endDate, roomId, all } = req.query;

    // If "all" is true and user is admin, return all bookings
    // Otherwise, return only user's bookings
    const filters: any = {};

    if (all !== "true") {
      filters.userId = userId;
    }

    if (status) filters.status = status;
    if (date) filters.date = date;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (roomId) filters.roomId = roomId;

    const bookings = await bookingRepository.getAllBookings(filters);
    res.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error("Error getting bookings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách đặt phòng",
    });
  }
};

export const getBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await bookingRepository.getBookingById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đặt phòng",
      });
    }

    res.json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error getting booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin đặt phòng",
    });
  }
};

export const getPendingBookings = async (_req: Request, res: Response) => {
  try {
    const bookings = await bookingRepository.getPendingBookings();
    res.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error("Error getting pending bookings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách chờ duyệt",
    });
  }
};

export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      roomId,
      bookingDate,
      startTime,
      endTime,
      meetingTitle,
      purpose,
      description,
      isPrivate,
      participantIds,
    } = req.body;

    // Validate required fields
    if (!roomId || !bookingDate || !startTime || !endTime || !meetingTitle) {
      return res.status(400).json({
        success: false,
        message: "Phòng, ngày, giờ và tên cuộc họp là bắt buộc",
      });
    }

    // Check if room exists
    const room = await floorRepository.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng họp",
      });
    }

    // Check availability
    const isAvailable = await bookingRepository.checkRoomAvailability(
      roomId,
      bookingDate,
      startTime,
      endTime
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: "Phòng đã được đặt trong khung giờ này",
      });
    }

    // Determine initial status
    // If room requires approval, status = pending
    // Otherwise, status = approved
    const status = (room as any).requires_approval ? "pending" : "approved";

    const bookingId = await bookingRepository.createBooking({
      roomId,
      userId,
      bookingDate,
      startTime,
      endTime,
      meetingTitle,
      purpose,
      description,
      isPrivate,
      status,
      participantIds,
    });

    const booking = await bookingRepository.getBookingById(bookingId);

    // Send notification
    if (status === "pending") {
      // Notify admin about pending booking
      try {
        const managerId = (room as any).manager_id || userId;
        const roomName = (room as any).name;
        await notificationService.notifyUser(
          managerId,
          "Yêu cầu đặt phòng mới",
          `Có yêu cầu đặt phòng "${roomName}" cho cuộc họp "${meetingTitle}"`,
          "system"
        );
      } catch (notifError) {
        console.error("Error sending notification:", notifError);
      }
    }

    // Log booking creation
    await auditLogger.logBookingCreate(
      userId,
      bookingId,
      (room as any).name || "Unknown Room",
      bookingDate,
      getIpAddress(req)
    );

    res.status(201).json({
      success: true,
      data: booking,
      message:
        status === "pending"
          ? "Đã gửi yêu cầu đặt phòng, đang chờ duyệt"
          : "Đặt phòng thành công",
    });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi đặt phòng",
    });
  }
};

export const updateBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    // Check if booking exists and belongs to user
    const existingBooking = await bookingRepository.getBookingById(id);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đặt phòng",
      });
    }

    if ((existingBooking as any).user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa đặt phòng này",
      });
    }

    if ((existingBooking as any).status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể chỉnh sửa đặt phòng đang chờ duyệt",
      });
    }

    await bookingRepository.updateBooking(id, req.body);
    const booking = await bookingRepository.getBookingById(id);
    res.json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật đặt phòng",
    });
  }
};

export const approveBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;

    const booking = await bookingRepository.getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đặt phòng",
      });
    }

    if ((booking as any).status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Đặt phòng này không ở trạng thái chờ duyệt",
      });
    }

    await bookingRepository.approveBooking(id, adminId);

    // Log booking approval
    const bookingData = booking as any;
    await auditLogger.logBookingApprove(
      adminId,
      id,
      bookingData.room_name || "Unknown Room",
      getIpAddress(req)
    );

    // Notify user
    try {
      await notificationService.notifyUser(
        bookingData.user_id,
        "Đặt phòng đã được duyệt",
        `Yêu cầu đặt phòng "${bookingData.roomName}" cho cuộc họp "${bookingData.meeting_title}" đã được phê duyệt`,
        "system"
      );
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    const updatedBooking = await bookingRepository.getBookingById(id);
    res.json({
      success: true,
      data: updatedBooking,
      message: "Đã phê duyệt đặt phòng",
    });
  } catch (error: any) {
    console.error("Error approving booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi phê duyệt đặt phòng",
    });
  }
};

export const rejectBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;

    const booking = await bookingRepository.getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đặt phòng",
      });
    }

    if ((booking as any).status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Đặt phòng này không ở trạng thái chờ duyệt",
      });
    }

    await bookingRepository.rejectBooking(id, adminId, reason);

    // Notify user
    try {
      const bookingData = booking as any;
      await notificationService.notifyUser(
        bookingData.user_id,
        "Đặt phòng bị từ chối",
        `Yêu cầu đặt phòng "${bookingData.roomName}" đã bị từ chối. ${reason ? `Lý do: ${reason}` : ""
        }`,
        "system"
      );
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    const updatedBooking = await bookingRepository.getBookingById(id);
    res.json({
      success: true,
      data: updatedBooking,
      message: "Đã từ chối đặt phòng",
    });
  } catch (error: any) {
    console.error("Error rejecting booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi từ chối đặt phòng",
    });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const booking = await bookingRepository.getBookingById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đặt phòng",
      });
    }

    if ((booking as any).user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đặt phòng này",
      });
    }

    if (
      (booking as any).status === "cancelled" ||
      (booking as any).status === "rejected"
    ) {
      return res.status(400).json({
        success: false,
        message: "Đặt phòng này đã bị hủy hoặc từ chối",
      });
    }

    await bookingRepository.cancelBooking(id);
    res.json({ success: true, message: "Đã hủy đặt phòng" });
  } catch (error: any) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi hủy đặt phòng",
    });
  }
};

export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await bookingRepository.deleteBooking(id);
    res.json({ success: true, message: "Đã xóa đặt phòng" });
  } catch (error: any) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa đặt phòng",
    });
  }
};

// ===================== PARTICIPANTS =====================

export const addParticipant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID là bắt buộc",
      });
    }

    await bookingRepository.addParticipant(id, userId);
    const participants = await bookingRepository.getBookingParticipants(id);
    res.json({ success: true, data: participants });
  } catch (error: any) {
    console.error("Error adding participant:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm người tham gia",
    });
  }
};

export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const { id, participantId } = req.params;
    await bookingRepository.removeParticipant(id, participantId);
    res.json({ success: true, message: "Đã xóa người tham gia" });
  } catch (error: any) {
    console.error("Error removing participant:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa người tham gia",
    });
  }
};
