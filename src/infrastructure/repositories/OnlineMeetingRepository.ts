import { ResultSetHeader, RowDataPacket } from "mysql2";
import { dbPool as db } from "../database/connection.js";
import {
    OnlineMeeting,
    OnlineMeetingWithDetails,
    ParticipantDetails,
    CreateOnlineMeetingDTO,
} from "../../domain/entities/OnlineMeeting.js";

export class OnlineMeetingRepository {
    /**
     * Generate unique Jitsi room name
     */
    private generateRoomName(): string {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        const randomStr = Array.from({ length: 12 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join("");
        return `nexus-${randomStr}`;
    }

    /**
     * Create a new online meeting
     */
    async createMeeting(
        data: CreateOnlineMeetingDTO,
        creatorId: string
    ): Promise<string> {
        const jitsiRoomName = this.generateRoomName();

        const [result] = await db.execute<ResultSetHeader>(
            `INSERT INTO online_meetings 
            (title, description, jitsi_room_name, creator_id, scheduled_start, scheduled_end, access_mode, jitsi_domain) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.title,
                data.description || null,
                jitsiRoomName,
                creatorId,
                data.scheduledStart,
                data.scheduledEnd || null,
                data.accessMode,
                "meet.jit.si",
            ]
        );

        const meetingId = result.insertId.toString();

        // Add participants if provided
        if (data.participantIds && data.participantIds.length > 0) {
            await this.addParticipants(meetingId, data.participantIds, creatorId);
        }

        return meetingId;
    }

    /**
     * Get meeting by ID with full details
     */
    async getMeetingById(id: string): Promise<OnlineMeetingWithDetails | null> {
        const [rows] = await db.execute<RowDataPacket[]>(
            `SELECT 
                m.*,
                u.full_name as creatorName,
                u.email as creatorEmail,
                u.avatar_url as creatorAvatar
            FROM online_meetings m
            JOIN users u ON m.creator_id = u.id
            WHERE m.id = ? AND m.deleted_at IS NULL`,
            [id]
        );

        if (rows.length === 0) return null;

        const meeting = rows[0];
        const participants = await this.getMeetingParticipants(id);

        return {
            id: meeting.id,
            title: meeting.title,
            description: meeting.description,
            jitsiRoomName: meeting.jitsi_room_name,
            creatorId: meeting.creator_id,
            scheduledStart: meeting.scheduled_start,
            scheduledEnd: meeting.scheduled_end,
            accessMode: meeting.access_mode,
            status: meeting.status,
            jitsiDomain: meeting.jitsi_domain,
            recordingUrl: meeting.recording_url,
            createdAt: meeting.created_at,
            updatedAt: meeting.updated_at,
            deletedAt: meeting.deleted_at,
            creatorName: meeting.creatorName,
            creatorEmail: meeting.creatorEmail,
            creatorAvatar: meeting.creatorAvatar,
            participants,
        };
    }

    /**
     * Get all meetings accessible by user
     */
    async getAccessibleMeetings(userId: string): Promise<OnlineMeetingWithDetails[]> {
        const [rows] = await db.execute<RowDataPacket[]>(
            `SELECT DISTINCT
                m.*,
                u.full_name as creatorName,
                u.email as creatorEmail,
                u.avatar_url as creatorAvatar
            FROM online_meetings m
            JOIN users u ON m.creator_id = u.id
            LEFT JOIN online_meeting_participants p ON m.id = p.meeting_id
            WHERE m.deleted_at IS NULL
            AND (
                m.creator_id = ?
                OR m.access_mode = 'public'
                OR p.user_id = ?
            )
            ORDER BY m.scheduled_start DESC`,
            [userId, userId]
        );

        const meetings = await Promise.all(
            rows.map(async (meeting) => {
                const participants = await this.getMeetingParticipants(meeting.id);
                return {
                    id: meeting.id,
                    title: meeting.title,
                    description: meeting.description,
                    jitsiRoomName: meeting.jitsi_room_name,
                    creatorId: meeting.creator_id,
                    scheduledStart: meeting.scheduled_start,
                    scheduledEnd: meeting.scheduled_end,
                    accessMode: meeting.access_mode,
                    status: meeting.status,
                    jitsiDomain: meeting.jitsi_domain,
                    recordingUrl: meeting.recording_url,
                    createdAt: meeting.created_at,
                    updatedAt: meeting.updated_at,
                    deletedAt: meeting.deleted_at,
                    creatorName: meeting.creatorName,
                    creatorEmail: meeting.creatorEmail,
                    creatorAvatar: meeting.creatorAvatar,
                    participants,
                };
            })
        );

        return meetings;
    }

    /**
     * Get participants of a meeting
     */
    async getMeetingParticipants(meetingId: string): Promise<ParticipantDetails[]> {
        const [rows] = await db.execute<RowDataPacket[]>(
            `SELECT 
                p.user_id as userId,
                p.invited_at as invitedAt,
                p.joined_at as joinedAt,
                u.full_name as userName,
                u.email,
                u.avatar_url as avatarUrl,
                d.name as departmentName
            FROM online_meeting_participants p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE p.meeting_id = ?
            ORDER BY p.invited_at ASC`,
            [meetingId]
        );

        return rows.map((row) => ({
            userId: row.userId,
            userName: row.userName,
            email: row.email,
            avatarUrl: row.avatarUrl,
            departmentName: row.departmentName,
            invitedAt: row.invitedAt,
            joinedAt: row.joinedAt,
        }));
    }

    /**
     * Add participants to a meeting
     */
    async addParticipants(
        meetingId: string,
        userIds: string[],
        invitedBy: string
    ): Promise<void> {
        if (userIds.length === 0) return;

        const values = userIds.map((userId) => [meetingId, userId, invitedBy]);
        await db.query(
            `INSERT INTO online_meeting_participants (meeting_id, user_id, invited_by) 
            VALUES ?
            ON DUPLICATE KEY UPDATE invited_by = VALUES(invited_by)`,
            [values]
        );
    }

    /**
     * Remove a participant from a meeting
     */
    async removeParticipant(meetingId: string, userId: string): Promise<void> {
        await db.execute(
            `DELETE FROM online_meeting_participants 
            WHERE meeting_id = ? AND user_id = ?`,
            [meetingId, userId]
        );
    }

    /**
     * Check if user has access to a meeting
     */
    async checkUserAccess(meetingId: string, userId: string): Promise<boolean> {
        const [rows] = await db.execute<RowDataPacket[]>(
            `SELECT 1
            FROM online_meetings m
            LEFT JOIN online_meeting_participants p ON m.id = p.meeting_id AND p.user_id = ?
            WHERE m.id = ? AND m.deleted_at IS NULL
            AND (
                m.creator_id = ?
                OR m.access_mode = 'public'
                OR p.user_id IS NOT NULL
            )`,
            [userId, meetingId, userId]
        );

        return rows.length > 0;
    }

    /**
     * Update meeting status
     */
    async updateMeetingStatus(
        meetingId: string,
        status: "scheduled" | "active" | "ended" | "cancelled"
    ): Promise<void> {
        await db.execute(
            `UPDATE online_meetings SET status = ? WHERE id = ?`,
            [status, meetingId]
        );
    }

    /**
     * Record participant join time
     */
    async recordParticipantJoin(meetingId: string, userId: string): Promise<void> {
        await db.execute(
            `UPDATE online_meeting_participants 
            SET joined_at = CURRENT_TIMESTAMP 
            WHERE meeting_id = ? AND user_id = ? AND joined_at IS NULL`,
            [meetingId, userId]
        );
    }

    /**
     * Delete a meeting (soft delete)
     */
    async deleteMeeting(meetingId: string): Promise<void> {
        await db.execute(
            `UPDATE online_meetings SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [meetingId]
        );
    }
}
