// Domain Entity: FloorPlan
// Represents a floor/area in the building with meeting rooms

export interface FloorPlan {
    id: string;
    floorNumber: number;
    name: string;                    // "Tầng 12 - Khu VIP"
    layoutImage?: string;            // URL to floor plan image (PNG/JPG/SVG)
    width: number;                   // Layout dimensions for positioning
    height: number;
    isActive: boolean;               // Active or inactive
    managerId?: string;              // Admin responsible for this floor
    managerName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface FloorPlanWithRooms extends FloorPlan {
    rooms?: MeetingRoom[];
    totalRooms?: number;
}

// Domain Entity: MeetingRoom
// Represents a physical meeting room within a floor

export type RoomType = 'standard' | 'vip' | 'training' | 'conference';
export type RoomStatus = 'active' | 'maintenance' | 'inactive';

export interface RoomPosition {
    x: number;
    y: number;
}

export interface MeetingRoom {
    id: string;
    floorId: string;                 // Reference to FloorPlan
    name: string;                    // "P.12-01", "Phòng VIP A"
    capacity: number;                // Max number of people
    roomType: RoomType;
    equipment: string[];             // ['TV', 'Máy chiếu', 'Video Conference', 'Bảng trắng']
    images: string[];                // URLs to room photos
    status: RoomStatus;
    requiresApproval: boolean;       // Needs admin approval for booking
    position: RoomPosition;          // Position on floor layout
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MeetingRoomWithFloor extends MeetingRoom {
    floorNumber?: number;
    floorName?: string;
}

// Booking status for real-time availability
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type BookingPurpose = 'project_review' | 'brainstorm' | 'training' | 'one_on_one' | 'interview' | 'other';

// Domain Entity: RoomBooking
// Represents a booking/reservation for a meeting room

export interface RoomBooking {
    id: string;
    roomId: string;                  // Reference to MeetingRoom
    userId: string;                  // User who made the booking
    userName?: string;
    userAvatar?: string;

    // Booking time
    bookingDate: string;             // YYYY-MM-DD
    startTime: string;               // HH:MM
    endTime: string;                 // HH:MM

    // Meeting details
    meetingTitle: string;
    purpose: BookingPurpose;
    description?: string;
    isPrivate: boolean;              // Private or public meeting

    // Participants
    participantIds: string[];
    participantNames?: string[];

    // Approval workflow
    status: BookingStatus;
    approvedBy?: string;             // Admin who approved/rejected
    approvedByName?: string;
    approvedAt?: string;
    rejectionReason?: string;

    createdAt: string;
    updatedAt: string;
}

export interface RoomBookingWithDetails extends RoomBooking {
    room?: MeetingRoom;
    roomName?: string;
    floorNumber?: number;
    floorName?: string;
}

// Request/Response DTOs
export interface CreateFloorRequest {
    floorNumber: number;
    name: string;
    layoutImage?: string;
    width?: number;
    height?: number;
    isActive?: boolean;
    managerId?: string;
}

export interface CreateRoomRequest {
    floorId: string;
    name: string;
    capacity: number;
    roomType: RoomType;
    equipment: string[];
    images?: string[];
    status?: RoomStatus;
    requiresApproval?: boolean;
    position: RoomPosition;
    description?: string;
}

export interface CreateBookingRequest {
    roomId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    meetingTitle: string;
    purpose: BookingPurpose;
    description?: string;
    isPrivate: boolean;
    participantIds: string[];
}

export interface RoomAvailabilityQuery {
    date: string;
    startTime?: string;
    endTime?: string;
    floorId?: string;
}

export interface RoomAvailabilityResult {
    roomId: string;
    roomName: string;
    floorId: string;
    floorName: string;
    status: 'available' | 'booked' | 'pending' | 'maintenance';
    currentBooking?: {
        id: string;
        meetingTitle: string;
        startTime: string;
        endTime: string;
        userName: string;
    };
}
