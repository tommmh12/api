-- =====================================================
-- Nexus Internal Portal - Database Creation
-- MySQL 8.0+
-- Version: 1.0
-- Created: December 8, 2025
-- =====================================================

-- Create database
CREATE DATABASE IF NOT EXISTS nexus_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE nexus_db;

-- Enable UUID support
SET @uuid_support = 1;
