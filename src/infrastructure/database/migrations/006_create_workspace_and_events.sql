-- =====================================================
-- Module: Workspace & Events
-- Tables: events, event_departments, event_attendees,
--         meeting_rooms, meeting_bookings
-- =====================================================

USE nexus_db;

-- Table: events
CREATE TABLE events (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('Workshop', 'Seminar', 'Party', 'Training', 'Meeting') NOT NULL,
    location VARCHAR(255),
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    max_attendees INT,
    access_level ENUM('Public', 'Private') DEFAULT 'Public',
    status ENUM('Upcoming', 'Ongoing', 'Completed', 'Cancelled') DEFAULT 'Upcoming',
    organizer_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_events_start (start_datetime),
    INDEX idx_events_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: event_departments (for Private events)
CREATE TABLE event_departments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_id CHAR(36) NOT NULL,
    department_id CHAR(36) NOT NULL,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_department (event_id, department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: event_attendees
CREATE TABLE event_attendees (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    status ENUM('Registered', 'Attended', 'Cancelled') DEFAULT 'Registered',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attended_at TIMESTAMP NULL,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_user (event_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: meeting_rooms
CREATE TABLE meeting_rooms (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL UNIQUE,
    type ENUM('Physical', 'Online') NOT NULL,
    location VARCHAR(255),
    capacity INT,
    meeting_link TEXT,
    facilities JSON,
    status ENUM('Available', 'Maintenance', 'Disabled') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: meeting_bookings
CREATE TABLE meeting_bookings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    organizer_id CHAR(36) NOT NULL,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    attendees JSON,
    status ENUM('Confirmed', 'Cancelled') DEFAULT 'Confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_bookings_room_time (room_id, start_datetime, end_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
