-- Migration: Add shared_documents table for shareable document links
-- Run this once against your PostgreSQL database

CREATE TABLE IF NOT EXISTS shared_documents (
    id           SERIAL PRIMARY KEY,
    token        UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    doctor_id    INTEGER NOT NULL,
    doc_type     VARCHAR(100) NOT NULL DEFAULT 'document',
    patient_name VARCHAR(255),
    html_content TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at   TIMESTAMP NOT NULL,
    view_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_docs_token ON shared_documents(token);
CREATE INDEX IF NOT EXISTS idx_shared_docs_doctor ON shared_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_shared_docs_expires ON shared_documents(expires_at);
