-- ═══════════════════════════════════════════════════════════════════════════
-- GP Clinic (DocWallet) — Complete Database Schema
-- Run this on a FRESH Neon PostgreSQL database.
-- All tables, columns, and indexes match the backend routes exactly.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS TABLE (doctors & assistants)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash TEXT          NOT NULL,
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('doctor', 'assistant')),
    doctor_id     INTEGER       REFERENCES users(id) ON DELETE CASCADE,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_doctor_id ON users(doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ASSISTANT PERMISSIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assistant_permissions (
    id           SERIAL PRIMARY KEY,
    assistant_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    dashboard    BOOLEAN NOT NULL DEFAULT FALSE,
    patients     BOOLEAN NOT NULL DEFAULT TRUE,
    drugs        BOOLEAN NOT NULL DEFAULT FALSE,
    expenditures BOOLEAN NOT NULL DEFAULT FALSE,
    queue        BOOLEAN NOT NULL DEFAULT TRUE,
    sms          BOOLEAN NOT NULL DEFAULT FALSE,
    assistant    BOOLEAN NOT NULL DEFAULT TRUE,
    doctor       BOOLEAN NOT NULL DEFAULT FALSE,
    settings     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_assistant ON assistant_permissions(assistant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CLINIC SETTINGS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_settings (
    id            SERIAL PRIMARY KEY,
    doctor_id     INTEGER       REFERENCES users(id) ON DELETE CASCADE,
    setting_key   VARCHAR(100)  NOT NULL,
    setting_value JSONB         NOT NULL,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_setting UNIQUE (doctor_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_settings_doc ON clinic_settings(doctor_id, setting_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PATIENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255)   NOT NULL,
    age        INTEGER        NOT NULL,
    telephone  VARCHAR(50)    NOT NULL,
    weight     NUMERIC(5, 2),
    height     NUMERIC(5, 2),
    allergies  TEXT,
    doctor_id  INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_telephone ON patients(telephone);
CREATE INDEX IF NOT EXISTS idx_patients_name      ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VISITS / QUEUE TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_date      DATE           NOT NULL DEFAULT CURRENT_DATE,
    queue_number    INTEGER        NOT NULL,
    status          VARCHAR(50)    NOT NULL DEFAULT 'Pending',
    diagnosis       TEXT,
    next_visit_date DATE,
    next_visit_plan TEXT,
    total_fee       NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_foc          BOOLEAN        NOT NULL DEFAULT FALSE,
    doctor_id       INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_queue     ON visits(visit_date, status, queue_number);
CREATE INDEX IF NOT EXISTS idx_visits_patient   ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DRUGS TABLE (Inventory)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drugs (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255)   NOT NULL,
    type             VARCHAR(100)   NOT NULL,
    expiry_date      DATE,
    selling_price    NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    buying_price     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notify_threshold INTEGER        NOT NULL DEFAULT 10,
    stock            INTEGER        NOT NULL DEFAULT 0,
    doctor_id        INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drugs_doctor_id ON drugs(doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PRESCRIPTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id            SERIAL PRIMARY KEY,
    visit_id      INTEGER        NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255)   NOT NULL,
    dosage        VARCHAR(100)   NOT NULL DEFAULT '',
    duration_days INTEGER        NOT NULL DEFAULT 3,
    price         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. EXPENDITURES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenditures (
    id          SERIAL PRIMARY KEY,
    exp_date    DATE           NOT NULL DEFAULT CURRENT_DATE,
    amount      NUMERIC(10, 2) NOT NULL,
    description TEXT           NOT NULL,
    category    VARCHAR(100)   NOT NULL DEFAULT 'Supplies',
    doctor_id   INTEGER        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenditures_date      ON expenditures(exp_date);
CREATE INDEX IF NOT EXISTS idx_expenditures_doctor_id ON expenditures(doctor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. INVESTIGATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investigations (
    id            SERIAL PRIMARY KEY,
    patient_id    INTEGER   NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id      INTEGER   REFERENCES visits(id) ON DELETE SET NULL,
    test_date     DATE      NOT NULL DEFAULT CURRENT_DATE,
    fbc           TEXT,
    fbs           TEXT,
    lipid_profile TEXT,
    ufr           TEXT,
    crp           TEXT,
    esr           TEXT,
    dengue_ns1    TEXT,
    influenza_ag  TEXT,
    lft           TEXT,
    tft           TEXT,
    rft           TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investigations_patient ON investigations(patient_id);
CREATE INDEX IF NOT EXISTS idx_investigations_visit   ON investigations(visit_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. DIAGNOSTIC IMAGES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_images (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER   NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id   INTEGER   REFERENCES visits(id) ON DELETE SET NULL,
    image_url  TEXT      NOT NULL,
    caption    VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diag_images_patient ON diagnostic_images(patient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. SHARED DOCUMENTS TABLE (DocWallet public links)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_documents (
    id           SERIAL PRIMARY KEY,
    token        UUID           NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    doctor_id    INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type     VARCHAR(100)   NOT NULL DEFAULT 'document',
    patient_name VARCHAR(255)   NOT NULL DEFAULT '',
    html_content TEXT           NOT NULL,
    expires_at   TIMESTAMP      NOT NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    view_count   INTEGER        NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_docs_token   ON shared_documents(token);
CREATE INDEX IF NOT EXISTS idx_shared_docs_doctor  ON shared_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_expires ON shared_documents(expires_at);
