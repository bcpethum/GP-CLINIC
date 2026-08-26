-- Migration 003: Ensure all required columns exist
-- Safe to run multiple times (uses IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

-- visits table columns
ALTER TABLE visits ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS next_visit_date DATE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS next_visit_plan TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_foc BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL DEFAULT '',
    duration_days INTEGER NOT NULL DEFAULT 3,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- drugs table columns
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS buying_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS notify_threshold INTEGER NOT NULL DEFAULT 10;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- patients table column
ALTER TABLE patients ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- investigations table
CREATE TABLE IF NOT EXISTS investigations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fbc TEXT,
    fbs TEXT,
    lipid_profile TEXT,
    ufr TEXT,
    crp TEXT,
    esr TEXT,
    dengue_ns1 TEXT,
    influenza_ag TEXT,
    lft TEXT,
    tft TEXT,
    rft TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_drugs_doctor_id ON drugs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_investigations_patient ON investigations(patient_id);
