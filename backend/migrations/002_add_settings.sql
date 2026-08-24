-- Migration 002: Add clinic_settings table
CREATE TABLE IF NOT EXISTS clinic_settings (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_setting UNIQUE (doctor_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_settings_doc ON clinic_settings(doctor_id, setting_key);
