-- Migration 003: Ensure all required columns exist
-- Safe to run multiple times (uses IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS)

-- visits table columns
ALTER TABLE visits ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS next_visit_date DATE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS next_visit_plan TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_fee NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS is_foc BOOLEAN DEFAULT FALSE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- expenditures table: ensure exp_date column exists (production may have 'date' instead)
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS exp_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Supplies';

-- If 'date' column exists but exp_date is empty, copy from it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenditures' AND column_name = 'date'
  ) THEN
    UPDATE expenditures SET exp_date = date::DATE WHERE exp_date IS NULL AND date IS NOT NULL;
  END IF;
END $$;

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
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS buying_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS notify_threshold INTEGER DEFAULT 10;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

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
CREATE INDEX IF NOT EXISTS idx_expenditures_doctor_id ON expenditures(doctor_id);
CREATE INDEX IF NOT EXISTS idx_expenditures_date ON expenditures(exp_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_investigations_patient ON investigations(patient_id);
