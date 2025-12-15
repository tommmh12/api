-- =====================================================
-- Module: Room Booking System
-- Tables: floor_plans, meeting_rooms, room_bookings, booking_participants
-- =====================================================

USE nexus_db;

-- Table: floor_plans
-- Represents floors/areas in the building
CREATE TABLE floor_plans (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    floor_number INT NOT NULL,
    name VARCHAR(255) NOT NULL,              -- "Tầng 12 - Khu VIP"
    layout_image TEXT,                       -- URL to floor plan image
    width INT DEFAULT 800,                   -- Layout dimensions
    height INT DEFAULT 600,
    is_active BOOLEAN DEFAULT TRUE,
    manager_id CHAR(36),                     -- Admin responsible for this floor
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_floor_number (floor_number),
    INDEX idx_floor_active (is_active, deleted_at),
    INDEX idx_floor_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: meeting_rooms
-- Represents physical meeting rooms within a floor
CREATE TABLE meeting_rooms (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    floor_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,              -- "P.12-01", "Phòng VIP A"
    capacity INT NOT NULL DEFAULT 10,
    room_type ENUM('standard', 'vip', 'training', 'conference') DEFAULT 'standard',
    equipment JSON,                          -- ['TV', 'Máy chiếu', 'Video Conference']
    images JSON,                             -- URLs to room photos
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    requires_approval BOOLEAN DEFAULT FALSE,
    position_x INT DEFAULT 0,                -- Position on floor layout
    position_y INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (floor_id) REFERENCES floor_plans(id) ON DELETE CASCADE,
    
    INDEX idx_room_floor (floor_id),
    INDEX idx_room_status (status, deleted_at),
    INDEX idx_room_type (room_type),
    INDEX idx_room_capacity (capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: room_bookings
-- Represents booking/reservation for meeting rooms
CREATE TABLE room_bookings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,               -- User who made the booking
    
    -- Booking time
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Meeting details
    meeting_title VARCHAR(255) NOT NULL,
    purpose ENUM('project_review', 'brainstorm', 'training', 'one_on_one', 'interview', 'other') DEFAULT 'other',
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    
    -- Approval workflow
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    approved_by CHAR(36),                    -- Admin who approved/rejected
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_booking_room (room_id),
    INDEX idx_booking_user (user_id),
    INDEX idx_booking_date (booking_date),
    INDEX idx_booking_status (status),
    INDEX idx_booking_room_date (room_id, booking_date, start_time, end_time),
    
    -- Constraint: Prevent overlapping bookings for the same room
    -- This will be enforced at application level for better control
    CONSTRAINT chk_booking_time CHECK (start_time < end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: booking_participants
-- Many-to-many relationship between bookings and users
CREATE TABLE booking_participants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    booking_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    
    FOREIGN KEY (booking_id) REFERENCES room_bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_booking_participant (booking_id, user_id),
    INDEX idx_participant_booking (booking_id),
    INDEX idx_participant_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample floor data
INSERT INTO floor_plans (id, floor_number, name, is_active) VALUES
(UUID(), 10, 'Tầng 10 - Khu Công nghệ', TRUE),
(UUID(), 11, 'Tầng 11 - Khu Hành chính', TRUE),
(UUID(), 12, 'Tầng 12 - Khu VIP', TRUE);
