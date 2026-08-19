# DocWallet - GP Clinic Patient Management System

A high-fidelity Patient Management System designed for clinical operations, patient registration, prescription tracking, inventory management, lab investigations tracing, and practice financial analytics.

Built with **Next.js** (Frontend), **Express.js** (Backend), and **PostgreSQL** (Database).

---

## Folder Structure

```
GP Clinic/
├── backend/
│   ├── routes/           # API routes (patients, queue, drugs, expenditures)
│   ├── uploads/          # Saved diagnostic scan uploads
│   ├── .env              # Backend configuration (DB Connection URL, Port)
│   ├── db.js             # PostgreSQL connection pool configuration
│   ├── package.json
│   ├── schema.sql        # Database tables initialization script
│   └── server.js         # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/ # View tabs components
│   │   │   ├── globals.css # Styling (Premium dark glassmorphism system)
│   │   │   ├── layout.js
│   │   │   └── page.js     # Index tab routing
│   │   └── ...
│   ├── next.config.js
│   └── package.json
└── README.md             # Setup guide
```

---

## Setup & Running Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** database engine

### 2. Database Initialization
1. Ensure your PostgreSQL service is running.
2. Create a new database named `gp_clinic_db`:
   ```bash
   # In terminal or pgAdmin
   CREATE DATABASE gp_clinic_db;
   ```
3. Initialize the schema and seed data by running the `schema.sql` script:
   ```bash
   psql -U postgres -d gp_clinic_db -f backend/schema.sql
   ```
   *(Ensure you supply the correct user name or adapt it based on your PostgreSQL configurations.)*

### 3. Backend Setup
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. (Optional) Open `.env` and verify the `DATABASE_URL` matches your local PostgreSQL credentials:
   ```env
   PORT=5000
   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/gp_clinic_db
   ```
4. Start the backend API server:
   ```bash
   npm run dev
   # Or using Node directly
   npm start
   ```
   *The backend server runs on [http://localhost:5000](http://localhost:5000).*

### 4. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   *The Next.js client is accessible at [http://localhost:3000](http://localhost:3000).*

---

## System Operational Walkthrough

Here is a simple flow to verify that the implementation is working end-to-end:

1. **Patient Check-in (Assistant Tab)**:
   - Search for a patient or enter a new one (e.g., *John Doe, Age 45, Phone 0771234567, Allergy: Penicillin*).
   - Click **Update & Send** to save the details and place them in the queue.
   - Click **Print Token** to see a print-friendly token slip.

2. **Consultation & Prescription (Doctor Tab)**:
   - The doctor views patients listed in the **Waiting Queue Line**. Click on the patient to activate their workspace.
   - Under **Diagnosis**, expand and write a clinical note.
   - Under **Prescription Builder**, search and select a drug (e.g., *Paracetamol 500mg*). Set dosage (e.g., `1-0-1`) and duration (e.g., `5` days) and click the **+** icon.
   - Expand **Lab Investigations Log** to view or enter blood values (FBC, FBS, etc.).
   - Click **Print Prescription** to print the official prescription layout page.
   - Click **Confirm & Send** to finalize the visit, record financials, and deduct drug inventory stock.

3. **Demographics, Uploads & Labs Timeline (Patients Tab)**:
   - Click on the patient in the Patients Directory.
   - Upload a diagnostic image (e.g., an ultrasound scan). The image is stored on the server and appears in the patient's gallery.
   - View chronological lists of previous visits and clinical records.
   - View the **Laboratory Investigations History** grid showing comparative test values over time.

4. **Drugs Stock Control (Drugs Tab)**:
   - View item catalog stocks. Items with stock below their notification threshold show an `OS` (Out of Stock / low stock) badge.
   - Use the **Restock** action to input new drug quantities.

5. **Financial Operations Metrics (Dashboard Tab)**:
   - View daily patient flow counts, incoming revenues, operational expenditures, and margins.
   - Use the **Log New Cost** form to record expenses (e.g., rent, utility payments). The dashboard metrics update immediately.
