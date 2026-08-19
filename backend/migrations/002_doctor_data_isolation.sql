-- GP Clinic Migration 002: Doctor Data Isolation
-- Adds doctor_id to patients, visits, drugs, and expenditures tables
-- so each doctor sees only their own data.
-- Safe to run on existing databases: uses IF NOT EXISTS / WHERE NULL guards.

-- 1. Add doctor_id to patients table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add doctor_id to visits table
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 3. Add doctor_id to drugs table
ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. Add doctor_id to expenditures table
ALTER TABLE expenditures
  ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 5. Assign all existing records to the first/oldest doctor account
UPDATE patients
SET doctor_id = (SELECT id FROM users WHERE role = 'doctor' ORDER BY created_at ASC LIMIT 1)
WHERE doctor_id IS NULL;

UPDATE visits
SET doctor_id = (SELECT id FROM users WHERE role = 'doctor' ORDER BY created_at ASC LIMIT 1)
WHERE doctor_id IS NULL;

UPDATE drugs
SET doctor_id = (SELECT id FROM users WHERE role = 'doctor' ORDER BY created_at ASC LIMIT 1)
WHERE doctor_id IS NULL;

UPDATE expenditures
SET doctor_id = (SELECT id FROM users WHERE role = 'doctor' ORDER BY created_at ASC LIMIT 1)
WHERE doctor_id IS NULL;

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id    ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id      ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_drugs_doctor_id       ON drugs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_expenditures_doctor_id ON expenditures(doctor_id);
