import { Request, Response } from "express";
import { OnlineMeetingRepository } from "../../infrastructure/repositories/OnlineMeetingRepository.js";
import { jitsiService } from "../../application/services/JitsiService.js";
import { CreateOnlineMeetingDTO } from "../../domain/entities/OnlineMeeting.js";
import { createLogger } from "../../infrastructure/logging/index.js";

const meetingRepository = new OnlineMeetingRepository();
const logger = createLogger("OnlineMeetingController");

/**
 * Create a new online meeting
 */
export const createMeeting = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const meetingData: CreateOnlineMeetingDTO = req.body;

        // Validate required fields
        if (!meetingData.title || !meetingData.scheduledStart) {
            return res.status(400).json({
                success: false,
                message: "Tên cuộc họp và thời gian bắt đầu là bắt buộc",
            });
        }

        // Create meeting
        const meetingId = await meetingRepository.createMeeting(meetingData, userId);
        const meeting = await meetingRepository.getMeetingById(meetingId);

        res.status(201).json({
            success: true,
            data: meeting,
            message: "Tạo cuộc họp thành công",
        });
    } catch (error: any) {
        logger.error("Error creating meeting", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo cuộc họp",
        });
    }
};

/**
 * Get all meetings accessible by current user
 */
export const getMeetings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        const meetings = await meetingRepository.getAccessibleMeetings(userId);

        res.json({
            success: true,
            data: meetings,
        });
    } catch (error: any) {
        logger.error("Error getting meetings", error, { userId: (req as any).user?.userId });
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách cuộc họp",
        });
    }
};

/**
 * Get meeting by ID
 */
export const getMeetingById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        // Check access
        const hasAccess = await meetingRepository.checkUserAccess(id, userId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xem cuộc họp này",
            });
        }

        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        res.json({
            success: true,
            data: meeting,
        });
    } catch (error: any) {
        logger.error("Error getting meeting", error, { meetingId: req.params.id });
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin cuộc họp",
        });
    }
};

/**
 * Get Jitsi join token for a meeting
 * This validates user access and generates JWT token
 */
export const getJoinToken = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;
        const userEmail = (req as any).user?.email;

        // Get meeting details
        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        // Check access
        const hasAccess = await meetingRepository.checkUserAccess(id, userId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền tham gia cuộc họp này",
            });
        }

        // Get user info from request (should be available from auth middleware)
        // For now, we'll fetch from meeting participants or use basic info
        const participant = meeting.participants.find(p => p.userId === userId);
        const userName = participant?.userName || (req as any).user?.name || 'User';
        const avatarUrl = participant?.avatarUrl;

        // Determine if user is moderator (creator of meeting)
        const isModerator = meeting.creatorId === userId;

        // Generate Jitsi join config
        const joinConfig = jitsiService.generateJoinConfig(
            userId,
            userName,
            userEmail,
            meeting.jitsiRoomName,
            isModerator,
            avatarUrl
        );

        // Record participant join attempt
        await meetingRepository.recordParticipantJoin(id, userId);

        // Update meeting status to active if it was scheduled
        if (meeting.status === 'scheduled') {
            await meetingRepository.updateMeetingStatus(id, 'active');
        }

        res.json({
            success: true,
            data: joinConfig,
        });
    } catch (error: any) {
        logger.error("Error getting join token", error, { meetingId: req.params.id });
        res.status(500).json({
            success: false,
            message: "Lỗi khi tạo token tham gia",
        });
    }
};

/**
 * Add participants to a meeting
 */
export const addParticipants = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body;
        const currentUserId = (req as any).user?.userId;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Danh sách người tham gia không hợp lệ",
            });
        }

        // Check if current user is the creator
        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        if (meeting.creatorId !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: "Chỉ người tạo cuộc họp mới có thể mời thêm người tham gia",
            });
        }

        await meetingRepository.addParticipants(id, userIds, currentUserId);
        const updatedMeeting = await meetingRepository.getMeetingById(id);

        res.json({
            success: true,
            data: updatedMeeting,
            message: "Đã mời người tham gia",
        });
    } catch (error: any) {
        logger.error("Error adding participants", error, { meetingId: req.params.id });
        res.status(500).json({
            success: false,
            message: "Lỗi khi mời người tham gia",
        });
    }
};

/**
 * Remove a participant from a meeting
 */
export const removeParticipant = async (req: Request, res: Response) => {
    try {
        const { id, userId } = req.params;
        const currentUserId = (req as any).user?.userId;

        // Check if current user is the creator
        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        if (meeting.creatorId !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: "Chỉ người tạo cuộc họp mới có thể xóa người tham gia",
            });
        }

        await meetingRepository.removeParticipant(id, userId);

        res.json({
            success: true,
            message: "Đã xóa người tham gia",
        });
    } catch (error: any) {
        logger.error("Error removing participant", error, { meetingId: req.params.id, userId: req.params.userId });
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa người tham gia",
        });
    }
};

/**
 * Update meeting status
 */
export const updateMeetingStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = (req as any).user?.userId;

        if (!['scheduled', 'active', 'ended', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ",
            });
        }

        // Check if user is creator
        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        if (meeting.creatorId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Chỉ người tạo cuộc họp mới có thể thay đổi trạng thái",
            });
        }

        await meetingRepository.updateMeetingStatus(id, status);
        const updatedMeeting = await meetingRepository.getMeetingById(id);

        res.json({
            success: true,
            data: updatedMeeting,
            message: "Đã cập nhật trạng thái cuộc họp",
        });
    } catch (error: any) {
        logger.error("Error updating meeting status", error, { meetingId: req.params.id, status: req.body.status });
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật trạng thái",
        });
    }
};

/**
 * Delete a meeting
 */
export const deleteMeeting = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;

        // Check if user is creator
        const meeting = await meetingRepository.getMeetingById(id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy cuộc họp",
            });
        }

        if (meeting.creatorId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Chỉ người tạo cuộc họp mới có thể xóa",
            });
        }

        await meetingRepository.deleteMeeting(id);

        res.json({
            success: true,
            message: "Đã xóa cuộc họp",
        });
    } catch (error: any) {
        logger.error("Error deleting meeting", error, { meetingId: req.params.id });
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa cuộc họp",
        });
    }
};
