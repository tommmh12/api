import { RowDataPacket } from "mysql2";
import { dbPool } from "../database/connection.js";
import crypto from "crypto";

export class FloorRepository {
    private db = dbPool;

    // ===================== FLOOR PLANS =====================

    async getAllFloors(includeInactive = false) {
        const query = `
      SELECT 
        fp.*,
        u.full_name as managerName,
        (SELECT COUNT(*) FROM meeting_rooms mr WHERE mr.floor_id = fp.id AND mr.deleted_at IS NULL) as totalRooms
      FROM floor_plans fp
      LEFT JOIN users u ON fp.manager_id = u.id
      WHERE fp.deleted_at IS NULL ${includeInactive ? "" : "AND fp.is_active = TRUE"}
      ORDER BY fp.floor_number ASC
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query);
        return rows;
    }

    async getFloorById(id: string) {
        const query = `
      SELECT 
        fp.*,
        u.full_name as managerName
      FROM floor_plans fp
      LEFT JOIN users u ON fp.manager_id = u.id
      WHERE fp.id = ? AND fp.deleted_at IS NULL
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);
        return rows[0] || null;
    }

    async getFloorByNumber(floorNumber: number) {
        const query = `
      SELECT * FROM floor_plans 
      WHERE floor_number = ? AND deleted_at IS NULL
    `;
        const [rows] = await this.db.query<RowDataPacket[]>(query, [floorNumber]);
        return rows[0] || null;
    }

    async createFloor(floorData: {
        floorNumber: number;
        name: string;
        layoutImage?: string;
        width?: number;
        height?: number;
        isActive?: boolean;
        managerId?: string;
    }) {
        const id = crypto.randomUUID();

        const query = `
      INSERT INTO floor_plans (
        id, floor_number, name, layout_image, width, height, is_active, manager_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        await this.db.query(query, [
            id,
            floorData.floorNumber,
            floorData.name,
            floorData.layoutImage || null,
            floorData.width || 800,
            floorData.height || 600,
            floorData.isActive !== false,
            floorData.managerId || null,
        ]);

        return id;
    }

    async updateFloor(id: string, floorData: Partial<{
        floorNumber: number;
        name: string;
        layoutImage: string;
        width: number;
        height: number;
        isActive: boolean;
        managerId: string;
    }>) {
        const updates: string[] = [];
        const values: any[] = [];

        if (floorData.floorNumber !== undefined) {
            updates.push("floor_number = ?");
            values.push(floorData.floorNumber);
        }
        if (floorData.name !== undefined) {
            updates.push("name = ?");
            values.push(floorData.name);
        }
        if (floorData.layoutImage !== undefined) {
            updates.push("layout_image = ?");
            values.push(floorData.layoutImage);
        }
        if (floorData.width !== undefined) {
            updates.push("width = ?");
            values.push(floorData.width);
        }
        if (floorData.height !== undefined) {
            updates.push("height = ?");
            values.push(floorData.height);
        }
        if (floorData.isActive !== undefined) {
            updates.push("is_active = ?");
            values.push(floorData.isActive);
        }
        if (floorData.managerId !== undefined) {
            updates.push("manager_id = ?");
            values.push(floorData.managerId || null);
        }

        if (updates.length === 0) return;

        const query = `
      UPDATE floor_plans 
      SET ${updates.join(", ")}
      WHERE id = ? AND deleted_at IS NULL
    `;

        values.push(id);
        await this.db.query(query, values);
    }

    async deleteFloor(id: string) {
        // Soft delete
        await this.db.query(
            "UPDATE floor_plans SET deleted_at = NOW() WHERE id = ?",
            [id]
        );
    }

    // ===================== MEETING ROOMS =====================

    async getAllRooms(floorId?: string) {
        let query = `
      SELECT 
        mr.*,
        fp.floor_number as floorNumber,
        fp.name as floorName
      FROM meeting_rooms mr
      LEFT JOIN floor_plans fp ON mr.floor_id = fp.id
      WHERE mr.deleted_at IS NULL
    `;

        const params: any[] = [];
        if (floorId) {
            query += " AND mr.floor_id = ?";
            params.push(floorId);
        }

        query += " ORDER BY fp.floor_number ASC, mr.name ASC";

        const [rows] = await this.db.query<RowDataPacket[]>(query, params);

        // Parse JSON fields
        return rows.map(row => ({
            ...row,
            equipment: row.equipment ? (typeof row.equipment === 'string' ? JSON.parse(row.equipment) : row.equipment) : [],
            images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : [],
        }));
    }

    async getRoomById(id: string) {
        const query = `
      SELECT 
        mr.*,
        fp.floor_number as floorNumber,
        fp.name as floorName
      FROM meeting_rooms mr
      LEFT JOIN floor_plans fp ON mr.floor_id = fp.id
      WHERE mr.id = ? AND mr.deleted_at IS NULL
    `;

        const [rows] = await this.db.query<RowDataPacket[]>(query, [id]);

        if (!rows[0]) return null;

        return {
            ...rows[0],
            equipment: rows[0].equipment ? (typeof rows[0].equipment === 'string' ? JSON.parse(rows[0].equipment) : rows[0].equipment) : [],
            images: rows[0].images ? (typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : rows[0].images) : [],
        };
    }

    async getRoomsByFloor(floorId: string) {
        return this.getAllRooms(floorId);
    }

    async createRoom(roomData: {
        floorId: string;
        name: string;
        capacity: number;
        roomType?: string;
        equipment?: string[];
        images?: string[];
        status?: string;
        requiresApproval?: boolean;
        positionX?: number;
        positionY?: number;
        description?: string;
    }) {
        const id = crypto.randomUUID();

        const query = `
      INSERT INTO meeting_rooms (
        id, floor_id, name, capacity, room_type, equipment, images,
        status, requires_approval, position_x, position_y, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        await this.db.query(query, [
            id,
            roomData.floorId,
            roomData.name,
            roomData.capacity,
            roomData.roomType || "standard",
            JSON.stringify(roomData.equipment || []),
            JSON.stringify(roomData.images || []),
            roomData.status || "active",
            roomData.requiresApproval || false,
            roomData.positionX || 0,
            roomData.positionY || 0,
            roomData.description || null,
        ]);

        return id;
    }

    async updateRoom(id: string, roomData: Partial<{
        floorId: string;
        name: string;
        capacity: number;
        roomType: string;
        equipment: string[];
        images: string[];
        status: string;
        requiresApproval: boolean;
        positionX: number;
        positionY: number;
        description: string;
    }>) {
        const updates: string[] = [];
        const values: any[] = [];

        if (roomData.floorId !== undefined) {
            updates.push("floor_id = ?");
            values.push(roomData.floorId);
        }
        if (roomData.name !== undefined) {
            updates.push("name = ?");
            values.push(roomData.name);
        }
        if (roomData.capacity !== undefined) {
            updates.push("capacity = ?");
            values.push(roomData.capacity);
        }
        if (roomData.roomType !== undefined) {
            updates.push("room_type = ?");
            values.push(roomData.roomType);
        }
        if (roomData.equipment !== undefined) {
            updates.push("equipment = ?");
            values.push(JSON.stringify(roomData.equipment));
        }
        if (roomData.images !== undefined) {
            updates.push("images = ?");
            values.push(JSON.stringify(roomData.images));
        }
        if (roomData.status !== undefined) {
            updates.push("status = ?");
            values.push(roomData.status);
        }
        if (roomData.requiresApproval !== undefined) {
            updates.push("requires_approval = ?");
            values.push(roomData.requiresApproval);
        }
        if (roomData.positionX !== undefined) {
            updates.push("position_x = ?");
            values.push(roomData.positionX);
        }
        if (roomData.positionY !== undefined) {
            updates.push("position_y = ?");
            values.push(roomData.positionY);
        }
        if (roomData.description !== undefined) {
            updates.push("description = ?");
            values.push(roomData.description || null);
        }

        if (updates.length === 0) return;

        const query = `
      UPDATE meeting_rooms 
      SET ${updates.join(", ")}
      WHERE id = ? AND deleted_at IS NULL
    `;

        values.push(id);
        await this.db.query(query, values);
    }

    async deleteRoom(id: string) {
        await this.db.query(
            "UPDATE meeting_rooms SET deleted_at = NOW() WHERE id = ?",
            [id]
        );
    }
}
