-- GP Clinic Database Schema Initialization (PostgreSQL)

-- Drop tables if they exist (for easy setup/re-run)
DROP TABLE IF EXISTS diagnostic_images CASCADE;
DROP TABLE IF EXISTS investigations CASCADE;
DROP TABLE IF EXISTS expenditures CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS drugs CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

-- 1. Patients Table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    telephone VARCHAR(50) NOT NULL,
    weight NUMERIC(5, 2), -- in kg
    height NUMERIC(5, 2), -- in cm
    allergies TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching patients quickly by telephone and name
CREATE INDEX idx_patients_telephone ON patients(telephone);
CREATE INDEX idx_patients_name ON patients(name);

-- 2. Visits/Queue Table
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    queue_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Active', 'Completed', 'Cancelled'
    diagnosis TEXT,
    next_visit_date DATE,
    next_visit_plan TEXT,
    total_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_foc BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index to fetch queue orders and date filters fast
CREATE INDEX idx_visits_queue ON visits(visit_date, status, queue_number);
CREATE INDEX idx_visits_patient ON visits(patient_id);

-- 3. Drugs Table (Inventory)
CREATE TABLE drugs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'Tablet', 'Syrup', 'Cream / LA', 'Dropper', 'Treatments & Other'
    expiry_date DATE,
    selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    buying_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notify_threshold INTEGER NOT NULL DEFAULT 10,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Prescriptions Table
CREATE TABLE prescriptions (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL, -- e.g., '1-0-1', 'M-D-N', '1 tds'
    duration_days INTEGER NOT NULL DEFAULT 3,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Expenditures Table
CREATE TABLE expenditures (
    id SERIAL PRIMARY KEY,
    exp_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Supplies', -- 'Drugs', 'Supplies', 'Rent', 'Utilities', 'Salaries', 'Other'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenditures_date ON expenditures(exp_date);

-- 6. Investigations Table (11 key laboratory test profiles)
CREATE TABLE investigations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    fbc TEXT,             -- Full Blood Count parameters
    fbs TEXT,             -- Fasting Blood Sugar
    lipid_profile TEXT,   -- Lipid Profile details
    ufr TEXT,             -- Urine Full Report
    crp TEXT,             -- C-Reactive Protein
    esr TEXT,             -- Erythrocyte Sedimentation Rate
    dengue_ns1 TEXT,      -- Dengue NS-1 Antigen
    influenza_ag TEXT,    -- Influenza Ag
    lft TEXT,             -- Liver Function Test
    tft TEXT,             -- Thyroid Function Test
    rft TEXT,             -- Renal Function Test
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_investigations_patient ON investigations(patient_id);

-- 7. Diagnostic Images Table
CREATE TABLE diagnostic_images (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some standard drugs for inventory demonstrate usability
INSERT INTO drugs (name, type, expiry_date, selling_price, buying_price, notify_threshold, stock) VALUES
('Paracetamol 500mg', 'Tablet', '2027-12-31', 5.00, 2.50, 50, 200),
('Amoxicillin 250mg', 'Tablet', '2027-06-30', 12.00, 6.00, 30, 100),
('Cetirizine 10mg', 'Tablet', '2028-03-15', 8.00, 3.50, 20, 150),
('Salbutamol Inhaler', 'Treatments & Other', '2027-09-20', 450.00, 300.00, 5, 20),
('Panadol Syrup', 'Syrup', '2027-11-05', 180.00, 120.00, 10, 45),
('Betnovate Cream', 'Cream / LA', '2027-08-18', 250.00, 180.00, 10, 30),
('Tears Naturale Eye Drops', 'Dropper', '2027-05-12', 320.00, 220.00, 8, 25);
