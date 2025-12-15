import { Request, Response } from "express";
import { FloorRepository } from "../../infrastructure/repositories/FloorRepository.js";
import { BookingRepository } from "../../infrastructure/repositories/BookingRepository.js";

const floorRepository = new FloorRepository();
const bookingRepository = new BookingRepository();

// ===================== FLOOR PLANS =====================

export const getFloors = async (req: Request, res: Response) => {
    try {
        const includeInactive = req.query.includeInactive === "true";
        const floors = await floorRepository.getAllFloors(includeInactive);
        res.json({ success: true, data: floors });
    } catch (error: any) {
        console.error("Error getting floors:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách tầng",
        });
    }
};

export const getFloorById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const floor = await floorRepository.getFloorById(id);

        if (!floor) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tầng",
            });
        }

        res.json({ success: true, data: floor });
    } catch (error: any) {
        console.error("Error getting floor:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin tầng",
        });
    }
};

export const createFloor = async (req: Request, res: Response) => {
    try {
        const { floorNumber, name, layoutImage, width, height, isActive, managerId } = req.body;

        if (!floorNumber || !name) {
            return res.status(400).json({
                success: false,
                message: "Số tầng và tên là bắt buộc",
            });
        }

        // Check if floor number already exists
        const existingFloor = await floorRepository.getFloorByNumber(floorNumber);
        if (existingFloor) {
            return res.status(400).json({
                success: false,
                message: `Tầng ${floorNumber} đã tồn tại`,
            });
        }

        const floorId = await floorRepository.createFloor({
            floorNumber,
            name,
            layoutImage,
            width,
            height,
            isActive,
            managerId,
        });

        const floor = await floorRepository.getFloorById(floorId);
        res.status(201).json({ success: true, data: floor });
    } catch (error: any) {
        console.error("Error creating floor:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Lỗi khi tạo tầng",
        });
    }
};

export const updateFloor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await floorRepository.updateFloor(id, req.body);
        const floor = await floorRepository.getFloorById(id);
        res.json({ success: true, data: floor });
    } catch (error: any) {
        console.error("Error updating floor:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật tầng",
        });
    }
};

export const deleteFloor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await floorRepository.deleteFloor(id);
        res.json({ success: true, message: "Đã xóa tầng thành công" });
    } catch (error: any) {
        console.error("Error deleting floor:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa tầng",
        });
    }
};

// ===================== MEETING ROOMS =====================

export const getRooms = async (req: Request, res: Response) => {
    try {
        const floorId = req.query.floorId as string | undefined;
        const rooms = await floorRepository.getAllRooms(floorId);
        res.json({ success: true, data: rooms });
    } catch (error: any) {
        console.error("Error getting rooms:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách phòng họp",
        });
    }
};

export const getRoomById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const room = await floorRepository.getRoomById(id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phòng họp",
            });
        }

        res.json({ success: true, data: room });
    } catch (error: any) {
        console.error("Error getting room:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin phòng họp",
        });
    }
};

export const getRoomsByFloor = async (req: Request, res: Response) => {
    try {
        const { floorId } = req.params;
        const rooms = await floorRepository.getRoomsByFloor(floorId);
        res.json({ success: true, data: rooms });
    } catch (error: any) {
        console.error("Error getting rooms by floor:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách phòng họp theo tầng",
        });
    }
};

export const createRoom = async (req: Request, res: Response) => {
    try {
        const {
            floorId,
            name,
            capacity,
            roomType,
            equipment,
            images,
            status,
            requiresApproval,
            positionX,
            positionY,
            description,
        } = req.body;

        if (!floorId || !name || !capacity) {
            return res.status(400).json({
                success: false,
                message: "Tầng, tên phòng và sức chứa là bắt buộc",
            });
        }

        const roomId = await floorRepository.createRoom({
            floorId,
            name,
            capacity,
            roomType,
            equipment,
            images,
            status,
            requiresApproval,
            positionX,
            positionY,
            description,
        });

        const room = await floorRepository.getRoomById(roomId);
        res.status(201).json({ success: true, data: room });
    } catch (error: any) {
        console.error("Error creating room:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Lỗi khi tạo phòng họp",
        });
    }
};

export const updateRoom = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await floorRepository.updateRoom(id, req.body);
        const room = await floorRepository.getRoomById(id);
        res.json({ success: true, data: room });
    } catch (error: any) {
        console.error("Error updating room:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật phòng họp",
        });
    }
};

export const deleteRoom = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await floorRepository.deleteRoom(id);
        res.json({ success: true, message: "Đã xóa phòng họp thành công" });
    } catch (error: any) {
        console.error("Error deleting room:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa phòng họp",
        });
    }
};

// ===================== ROOM AVAILABILITY =====================

export const getRoomAvailability = async (req: Request, res: Response) => {
    try {
        const { date, floorId } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Ngày là bắt buộc",
            });
        }

        const availability = await bookingRepository.getRoomAvailabilityForDate(
            date as string,
            floorId as string | undefined
        );

        res.json({ success: true, data: availability });
    } catch (error: any) {
        console.error("Error getting room availability:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi kiểm tra khả dụng phòng họp",
        });
    }
};

export const checkRoomAvailability = async (req: Request, res: Response) => {
    try {
        const { roomId, date, startTime, endTime, excludeBookingId } = req.query;

        if (!roomId || !date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Phòng, ngày, giờ bắt đầu và giờ kết thúc là bắt buộc",
            });
        }

        const isAvailable = await bookingRepository.checkRoomAvailability(
            roomId as string,
            date as string,
            startTime as string,
            endTime as string,
            excludeBookingId as string | undefined
        );

        res.json({ success: true, data: { isAvailable } });
    } catch (error: any) {
        console.error("Error checking room availability:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi kiểm tra khả dụng",
        });
    }
};
