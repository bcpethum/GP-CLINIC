-- GP Clinic Auth Migration 001: Add Authentication Tables
-- Run this ONCE on an existing database.
-- Safe to run: does NOT drop existing tables (patients, visits, drugs, etc.)

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255)        NOT NULL,
    email        VARCHAR(255)        NOT NULL UNIQUE,
    password_hash TEXT               NOT NULL,
    role         VARCHAR(20)         NOT NULL CHECK (role IN ('doctor', 'assistant')),
    doctor_id    INTEGER             REFERENCES users(id) ON DELETE CASCADE,
    is_active    BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast email lookup during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- Index for finding all assistants belonging to a doctor
CREATE INDEX IF NOT EXISTS idx_users_doctor_id ON users(doctor_id);

-- ============================================================
-- 2. ASSISTANT PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS assistant_permissions (
    id           SERIAL PRIMARY KEY,
    assistant_id INTEGER             NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Tab/feature permissions (true = allowed)
    dashboard    BOOLEAN             NOT NULL DEFAULT FALSE,
    patients     BOOLEAN             NOT NULL DEFAULT TRUE,
    drugs        BOOLEAN             NOT NULL DEFAULT FALSE,
    expenditures BOOLEAN             NOT NULL DEFAULT FALSE,
    queue        BOOLEAN             NOT NULL DEFAULT TRUE,
    sms          BOOLEAN             NOT NULL DEFAULT FALSE,
    assistant    BOOLEAN             NOT NULL DEFAULT TRUE,
    doctor       BOOLEAN             NOT NULL DEFAULT FALSE,
    settings     BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_assistant ON assistant_permissions(assistant_id);
