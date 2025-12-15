import { RowDataPacket } from "mysql2";
import { dbPool, withTransaction } from "../database/connection.js";
import crypto from "crypto";

/**
 * BookingRepository
 * Data access layer for room bookings
 * Requirements: 12.3 - Database operations with transaction rollback
 */
export class BookingRepository {
    private db = dbPool;

    // ===================== ROOM BOOKINGS =====================

    async getAllBookings(filters?: {
        roomId?: string;
        userId?: string;
        status?: string;
        date?: string;
        startDate?: string;
        endDate?: string;
    }) {
        let query = `
      SELECT 
        rb.*,
        mr.name as roomName,
        mr.capacity as roomCapacity,
        mr.room_type as roomType,
        fp.floor_number as floorNumber,
        fp.name as floorName,
        u.full_name as userName,
        u.avatar_url as userAvatar,
        approver.full_name as approvedByName
      FROM room_bookings rb
      LEFT JOIN meeting_rooms mr ON rb.room_id = mr.id
      LEFT JOIN floor_plans fp ON mr.floor_id = fp.id
      LEFT JOIN users u ON rb.user_id = u.id
      LEFT JOIN users approver ON rb.approved_by = approver.id
      WHERE rb.deleted_at IS NULL
    `;

        const params: any[] = [];

        if (filters?.roomId) {
            query += " AND rb.room_id = ?";
            params.push(filters.roomId);
        }
        if (filters?.userId) {
            query += " AND rb.user_id = ?";
            params.push(filters.userId);
        }
        if (filters?.status) {
            query += " AND rb.status = ?";
            params.push(filters.status);
        }
        if (filters?.date) {
            query += " AND rb.booking_date = ?";
            params.push(filters.date);
        }
        if (filters?.startDate) {
            query += " AND rb.booking_date >= ?";
            params.push(filters.startDate);
        }
        if (filters?.endDate) {
            query += " AND rb.booking_date <= ?";
            params.push(filters.endDate);
        }

        query += " ORDER BY rb.booking_date ASC, rb.start_time ASC";

        const [rows] = await this.db.query<RowDataPacket[]>(query, params);
        return rows;
    }

    async getBookingById(id: string) {
        const query = `
      SELECT 
        rb.*,
        mr.name as roomName,
        mr.capacity as roomCapacity,
        mr.room_type as roomType,
        mr.equipment,
        mr.images,
        fp.floor_number as floorNumber,
        fp.name as floorName,
        u.full_name as userName,
        u.avatar_url as userAvatar,
        u.email as userEmail,
        approver.full_name as approvedByName
      FROM room_bookings rb
      LEFT JOIN meeting_rooms mr ON rb.room_id = mr.id
      LEFT JOIN floor_plans fp ON mr.floor_id = fp.id
      LEFT JOIN users u ON rb.user_id = u.id
      LEFT JOIN users approver ON rb.approved_by = approver.id
      WHERE rb.id = ? AND rb.deleted_at IS NULL
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);

        if (!rows[0]) return null;

        // Get participants
        const booking = rows[0];
        const participants = await this.getBookingParticipants(id);

        return {
            ...booking,
            equipment: booking.equipment ? (typeof booking.equipment === 'string' ? JSON.parse(booking.equipment) : booking.equipment) : [],
            images: booking.images ? (typeof booking.images === 'string' ? JSON.parse(booking.images) : booking.images) : [],
            participants,
        };
    }

    async getUserBookings(userId: string, status?: string) {
        return this.getAllBookings({ userId, status });
    }

    async getPendingBookings() {
        return this.getAllBookings({ status: "pending" });
    }

    async getBookingsForRoom(roomId: string, date: string) {
        const query = `
      SELECT 
        rb.*,
        u.full_name as userName
      FROM room_bookings rb
      LEFT JOIN users u ON rb.user_id = u.id
      WHERE rb.room_id = ? 
        AND rb.booking_date = ? 
        AND rb.status IN ('pending', 'approved')
        AND rb.deleted_at IS NULL
      ORDER BY rb.start_time ASC
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query, [roomId, date]);
        return rows;
    }

    async checkRoomAvailability(
        roomId: string,
        date: string,
        startTime: string,
        endTime: string,
        excludeBookingId?: string
    ): Promise<boolean> {
        let query = `
      SELECT COUNT(*) as conflictCount
      FROM room_bookings
      WHERE room_id = ?
        AND booking_date = ?
        AND status IN ('pending', 'approved')
        AND deleted_at IS NULL
        AND (
          (start_time < ? AND end_time > ?)
          OR (start_time >= ? AND start_time < ?)
          OR (end_time > ? AND end_time <= ?)
        )
    `;

        const params: any[] = [
            roomId,
            date,
            endTime, startTime,   // Overlaps completely
            startTime, endTime,    // Starts within
            startTime, endTime,    // Ends within
        ];

        if (excludeBookingId) {
            query += " AND id != ?";
            params.push(excludeBookingId);
        }

        const [rows] = await this.db.query<RowDataPacket[]>(query, params);
        return rows[0].conflictCount === 0;
    }

    async createBooking(bookingData: {
        roomId: string;
        userId: string;
        bookingDate: string;
        startTime: string;
        endTime: string;
        meetingTitle: string;
        purpose?: string;
        description?: string;
        isPrivate?: boolean;
        status?: string;
        participantIds?: string[];
    }) {
        const id = crypto.randomUUID();

        await withTransaction(async (ctx) => {
            const query = `
        INSERT INTO room_bookings (
          id, room_id, user_id, booking_date, start_time, end_time,
          meeting_title, purpose, description, is_private, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await ctx.query(query, [
                id,
                bookingData.roomId,
                bookingData.userId,
                bookingData.bookingDate,
                bookingData.startTime,
                bookingData.endTime,
                bookingData.meetingTitle,
                bookingData.purpose || "other",
                bookingData.description || null,
                bookingData.isPrivate || false,
                bookingData.status || "pending",
            ]);

            // Add participants
            if (bookingData.participantIds && bookingData.participantIds.length > 0) {
                const participantValues = bookingData.participantIds.map(pId => [
                    crypto.randomUUID(),
                    id,
                    pId,
                ]);

                await ctx.query(
                    `INSERT INTO booking_participants (id, booking_id, user_id) VALUES ?`,
                    [participantValues]
                );
            }
        });

        return id;
    }

    async updateBooking(id: string, bookingData: Partial<{
        bookingDate: string;
        startTime: string;
        endTime: string;
        meetingTitle: string;
        purpose: string;
        description: string;
        isPrivate: boolean;
    }>) {
        const updates: string[] = [];
        const values: any[] = [];

        if (bookingData.bookingDate !== undefined) {
            updates.push("booking_date = ?");
            values.push(bookingData.bookingDate);
        }
        if (bookingData.startTime !== undefined) {
            updates.push("start_time = ?");
            values.push(bookingData.startTime);
        }
        if (bookingData.endTime !== undefined) {
            updates.push("end_time = ?");
            values.push(bookingData.endTime);
        }
        if (bookingData.meetingTitle !== undefined) {
            updates.push("meeting_title = ?");
            values.push(bookingData.meetingTitle);
        }
        if (bookingData.purpose !== undefined) {
            updates.push("purpose = ?");
            values.push(bookingData.purpose);
        }
        if (bookingData.description !== undefined) {
            updates.push("description = ?");
            values.push(bookingData.description || null);
        }
        if (bookingData.isPrivate !== undefined) {
            updates.push("is_private = ?");
            values.push(bookingData.isPrivate);
        }

        if (updates.length === 0) return;

        const query = `
      UPDATE room_bookings 
      SET ${updates.join(", ")}
      WHERE id = ? AND deleted_at IS NULL
    `;

        values.push(id);
        await this.db.query(query, values);
    }

    async approveBooking(bookingId: string, approvedBy: string) {
        const query = `
      UPDATE room_bookings 
      SET status = 'approved', approved_by = ?, approved_at = NOW()
      WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
    `;

        await this.db.query(query, [approvedBy, bookingId]);
    }

    async rejectBooking(bookingId: string, approvedBy: string, reason?: string) {
        const query = `
      UPDATE room_bookings 
      SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ?
      WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
    `;

        await this.db.query(query, [approvedBy, reason || null, bookingId]);
    }

    async cancelBooking(bookingId: string) {
        await this.db.query(
            "UPDATE room_bookings SET status = 'cancelled' WHERE id = ? AND deleted_at IS NULL",
            [bookingId]
        );
    }

    async deleteBooking(id: string) {
        await this.db.query(
            "UPDATE room_bookings SET deleted_at = NOW() WHERE id = ?",
            [id]
        );
    }

    // ===================== PARTICIPANTS =====================

    async getBookingParticipants(bookingId: string) {
        const query = `
      SELECT 
        bp.*,
        u.full_name as userName,
        u.email,
        u.avatar_url as userAvatar,
        d.name as departmentName
      FROM booking_participants bp
      LEFT JOIN users u ON bp.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE bp.booking_id = ?
      ORDER BY bp.invited_at ASC
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query, [bookingId]);
        return rows;
    }

    async addParticipant(bookingId: string, userId: string) {
        const id = crypto.randomUUID();
        await this.db.query(
            `INSERT INTO booking_participants (id, booking_id, user_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE invited_at = NOW()`,
            [id, bookingId, userId]
        );
    }

    async removeParticipant(bookingId: string, userId: string) {
        await this.db.query(
            "DELETE FROM booking_participants WHERE booking_id = ? AND user_id = ?",
            [bookingId, userId]
        );
    }

    async updateParticipantResponse(
        bookingId: string,
        userId: string,
        status: "accepted" | "declined"
    ) {
        await this.db.query(
            `UPDATE booking_participants 
       SET response_status = ?, responded_at = NOW()
       WHERE booking_id = ? AND user_id = ?`,
            [status, bookingId, userId]
        );
    }

    // ===================== ROOM AVAILABILITY =====================

    async getRoomAvailabilityForDate(date: string, floorId?: string) {
        let query = `
      SELECT 
        mr.id as roomId,
        mr.name as roomName,
        mr.capacity,
        mr.room_type as roomType,
        mr.status as roomStatus,
        mr.requires_approval as requiresApproval,
        mr.position_x as positionX,
        mr.position_y as positionY,
        fp.id as floorId,
        fp.floor_number as floorNumber,
        fp.name as floorName,
        rb.id as bookingId,
        rb.meeting_title as meetingTitle,
        rb.start_time as startTime,
        rb.end_time as endTime,
        rb.status as bookingStatus,
        u.full_name as bookedBy
      FROM meeting_rooms mr
      LEFT JOIN floor_plans fp ON mr.floor_id = fp.id
      LEFT JOIN room_bookings rb ON mr.id = rb.room_id 
        AND rb.booking_date = ? 
        AND rb.status IN ('pending', 'approved')
        AND rb.deleted_at IS NULL
      LEFT JOIN users u ON rb.user_id = u.id
      WHERE mr.deleted_at IS NULL AND fp.is_active = TRUE
    `;

        const params: any[] = [date];

        if (floorId) {
            query += " AND mr.floor_id = ?";
            params.push(floorId);
        }

        query += " ORDER BY fp.floor_number ASC, mr.name ASC, rb.start_time ASC";

        const [rows] = await this.db.query<RowDataPacket[]>(query, params);

        // Group by room and aggregate bookings
        const roomMap = new Map<string, any>();

        for (const row of rows) {
            if (!roomMap.has(row.roomId)) {
                roomMap.set(row.roomId, {
                    roomId: row.roomId,
                    roomName: row.roomName,
                    capacity: row.capacity,
                    roomType: row.roomType,
                    roomStatus: row.roomStatus,
                    requiresApproval: row.requiresApproval,
                    positionX: row.positionX,
                    positionY: row.positionY,
                    floorId: row.floorId,
                    floorNumber: row.floorNumber,
                    floorName: row.floorName,
                    bookings: [],
                });
            }

            if (row.bookingId) {
                roomMap.get(row.roomId).bookings.push({
                    bookingId: row.bookingId,
                    meetingTitle: row.meetingTitle,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    status: row.bookingStatus,
                    bookedBy: row.bookedBy,
                });
            }
        }

        return Array.from(roomMap.values());
    }
}
