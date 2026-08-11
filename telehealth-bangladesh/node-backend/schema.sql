-- ========================================================================
--              HealNsightTELEMEDICINE PLATFORM
--              Forgot Password Feature DB Schema (MySQL/SQLite)
-- ========================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'patient', -- 'patient', 'doctor', 'admin'
  `first_name` VARCHAR(100),
  `last_name` VARCHAR(100),
  `password_updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. OTP Verification Table
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone_or_email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL, -- bcrypt/sha255 hashed OTP code
  `expiry_time` TIMESTAMP NOT NULL,
  `retry_attempts` INT DEFAULT 0, -- Track number of wrong OTP entries (max 3)
  `is_used` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Password Reset Logs Table
CREATE TABLE IF NOT EXISTS `password_reset_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `request_ip` VARCHAR(45) NOT NULL,
  `user_agent` TEXT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'requested', -- 'requested', 'verified', 'completed', 'expired'
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- 4. Authentication Logs / Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL, -- NULL indicates unauthenticated action (e.g. failed login attempt)
  `action` VARCHAR(100) NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'PASSWORD_RESET_REQ', 'PASSWORD_RESET_SUCCESS', etc.
  `details` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- Indexing for fast credential querying
CREATE INDEX idx_users_email_phone ON `users` (`email`, `phone`);
CREATE INDEX idx_otp_phone_email ON `otp_verifications` (`phone_or_email`);
CREATE INDEX idx_audit_logs_action ON `audit_logs` (`action`);
