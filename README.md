# GP CLINIC - Patient Management System

A full-stack, enterprise-grade Patient Management System designed for medical clinics, general practices, and OPD centers. Streamlines clinical workflows, patient registrations, queue handling, smart prescriptions, diagnostic imaging, multi-parameter lab tracking, medicine inventory, and practice financial analytics.

Built with **Next.js** (Frontend), **Express.js** (Backend), and **PostgreSQL** (Database).

---

## Key Features

- **Role-Based Authentication & Access Control**:
  - Secure JWT authentication for **Doctors** and **Assistants**.
  - Granular permissions for staff members (Queue management, Demographics, Prescriptions, Financials).
  - Multi-assistant management with credential issuance and access revocation.

- **Doctor Consultation Workspace**:
  - Live patient waiting queue with instant consultation switcher.
  - Fast demographic lookup by phone or name with age calculation (Years & Months).
  - Built-in **QR Code Generator** for patient identity verification.
  - Collapsible clinical panels:
    - **Diagnosis & Current Illness**
    - **Last Visit Details & History**
    - **Lab Investigations Log** (11 key laboratory parameters: FBC, FBS, Lipid Profile, UFR, C-RP, ESR, Dengue NS-1, Influenza, LFT, TFT, RFT)
    - **Next Visit Schedule & Action Plan**
  - Smart prescription builder with instant inventory search, standard dosage quantity & frequency selectors (`M`, `N`, `BD`, `TDS`, `QDS`, `SOS`, `STAT`, etc.), and automatic bill calculation.
  - Consultation fee manager with one-click **Free of Charge (FOC)** toggle.
  - Customizable **Prescription Printing** featuring digital doctor seals, signatures, and custom headers.

- **Assistant Reception & Queue Management**:
  - Rapid patient intake, demographic registration, and queue ticket assignment.
  - Printable queue tokens for patient dispensing.

- **Patient Records & Diagnostic Scans**:
  - Date-filtered patient directory (**All**, **Today**, **Yesterday**, **Last 7 Days**, **Last 30 Days**).
  - Last visit date badge indicators.
  - Demographic editor and patient deletion with full cascading cleanup.
  - **Database-Stored Diagnostic Scan Gallery**: Upload X-rays, ultrasound scans, and lab reports stored directly in PostgreSQL (Base64 Data URIs) with high-resolution lightbox preview.
  - Historical laboratory parameter timeline and past clinical encounter logs.

- **Pharmacy & Stock Control**:
  - Live drug inventory tracking with automatic stock deduction upon prescription dispatch.
  - Low-stock notification thresholds and alert badges (`OS` / Out of Stock).
  - Restocking logs and cost/selling price management.

- **Financial Operations & Dashboard**:
  - Real-time practice analytics filtered by date: daily patient volume, gross revenue, operational expenditures, and net margin.
  - Expenditure register categorized by Drugs, Supplies, Rent, Utilities, Salaries, and Miscellaneous costs.

- **SMS & Communication**:
  - SMS broadcast and notification panel for patient reminders and appointment follow-ups.

- **Clinic & Prescription Settings**:
  - Clinic branding (Name, Address, Hotline, Doctor Registration).
  - Digital Doctor Seal & Signature upload.
  - Dynamic prescription layout and styling customizer.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 / React, Lucide Icons, Vanilla CSS Glassmorphism Design System |
| **Backend** | Node.js, Express.js, Multer (In-Memory Processing), JSON Web Tokens (JWT), bcryptjs |
| **Database** | PostgreSQL |

---

## Folder Structure

```
GP Clinic/
├── .gitignore            # Git ignore rules (node_modules, .env, build output)
├── README.md             # Project documentation & setup guide
├── backend/
│   ├── middleware/       # Auth & Role-based permission middlewares
│   ├── routes/           # REST API endpoints
│   │   ├── assistants.js # Staff user management
│   │   ├── auth.js       # Login & authentication routes
│   │   ├── drugs.js      # Drug inventory & stock logs
│   │   ├── expenditures.js # Expense ledger
│   │   ├── patients.js   # Patient records, history & scans
│   │   ├── queue.js      # Waiting queue & daily statistics
│   │   └── settings.js   # Clinic profile & prescription design
│   ├── uploads/          # Directory preserved for static assets
│   ├── .env              # Backend configuration (PORT, DATABASE_URL, JWT_SECRET)
│   ├── db.js             # PostgreSQL connection pool configuration
│   ├── package.json
│   ├── schema.sql        # PostgreSQL database schema & seed data
│   └── server.js         # Express server entry point
└── frontend/
    ├── src/
    │   └── app/
    │       ├── components/ # Tab components (Doctor, Assistant, Patients, Drugs, Dashboard, SMS, Settings)
    │       ├── context/    # Auth context provider
    │       ├── lib/        # API client, prescription generator & helpers
    │       ├── globals.css # Styling & design tokens
    │       ├── layout.js   # Root HTML layout
    │       └── page.js     # Main application container & tab router
    ├── next.config.js
    └── package.json
```

---

## Setup & Running Guide

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **PostgreSQL** (v14 or higher)

---

### 2. Database Initialization

1. Start your local PostgreSQL service.
2. Create a new database named `gp_clinic_db`:
   ```sql
   CREATE DATABASE gp_clinic_db;
   ```
3. Initialize the schema and seed data by executing `schema.sql`:
   ```bash
   # Linux / macOS / Git Bash
   psql -U postgres -d gp_clinic_db -f backend/schema.sql

   # Or in Windows PowerShell:
   Get-Content backend\schema.sql | psql -U postgres -d gp_clinic_db
   ```
   *(Alternatively, run the SQL script inside pgAdmin or DBeaver).*

---

### 3. Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create or verify your `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/gp_clinic_db
   JWT_SECRET=your_secure_jwt_secret_key_here
   FRONTEND_URL=http://localhost:3000
   ```
4. Start the backend API server:
   ```bash
   npm run dev
   ```
   *The backend will run on `http://localhost:5000`.*

---

### 4. Frontend Setup

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Operational Workflow

1. **Reception Check-in (Assistant Tab)**:
   - Search by phone number or register a new patient.
   - Click **Update & Send** to place the patient in the queue and print an OPD token.

2. **Doctor Consultation (Doctor Tab)**:
   - Select patient from the live queue list.
   - Record diagnosis and review previous encounter history.
   - Enter laboratory test values in the **Lab Investigations Log**.
   - Prescribe medications with automated stock check and pricing.
   - Set the **Next Visit Schedule** date and plan.
   - Click **Print Prescription** to generate a printable prescription.
   - Click **Confirm & Send** to complete the visit and automatically deduct pharmacy inventory.

3. **Patient History & Diagnostic Scans (Patients Tab)**:
   - Filter patients by visit date (**Today**, **Yesterday**, **Last 7 Days**, etc.).
   - Upload and view diagnostic imaging (X-rays, Scans) with high-resolution lightbox view.
   - Track multi-visit laboratory progression.

4. **Pharmacy Restock (Drugs Tab)**:
   - Monitor real-time stock levels and replenish inventory.

5. **Practice Financial Ledger (Dashboard Tab)**:
   - Monitor revenue, costs, and net margin for any selected date.
   - Log operational costs and overhead expenses.
