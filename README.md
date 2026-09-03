# HRIS — Admin Platform

Admin-side monorepo for the HRIS system: an Express/PostgreSQL API and a React admin console used by HR/admin staff to manage employees, attendance, payroll, and related HR operations. (The employee-facing self-service PWA lives in the separate `hris-user` repo and consumes the same API.)

## Repo layout

```
hris/
├── hris-backend/     Express API + Knex/Objection + scheduler worker
└── hris-frontend/    React (Vite) admin console
```

## Stack

**Backend** (`hris-backend/`)
- Node.js, Express 5, Objection.js + Knex (PostgreSQL)
- JWT auth (access/refresh/temp/reset tokens), bcrypt, `express-validator`, `helmet`
- `node-cron` scheduler worker for background jobs
- AWS SDK v3: S3 (document storage) and Rekognition (face recognition / liveness)
- `pdfkit` for generated PDFs (payslips, government forms)

**Frontend** (`hris-frontend/`)
- React 19 + Vite, React Router 7
- TanStack Query for data fetching, Axios for HTTP
- Tailwind CSS 4, Formik + Yup for forms/validation
- Recharts (dashboard analytics), `@aws-amplify/ui-react-liveness` (Face Liveness), `sonner` (toasts)

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL 13+** running locally (or reachable), with a superuser/role you can
  connect as. The `uuid-ossp` and `pgcrypto` extensions are used, but the
  migrations enable them automatically (`CREATE EXTENSION IF NOT EXISTS …`), so
  the connecting role just needs permission to do so.
- AWS account/credentials only if you enable document storage, face recognition,
  or the Attendance Kiosk — every AWS feature is disabled when its bucket/collection
  env vars are left blank.

## Getting started (backend)

### 1. Clone and install

```bash
git clone <repo-url> hris
cd hris/hris-backend
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

`.env.example` is the full, commented reference. The minimum you must set for a
local run:

| Variable | Notes |
|---|---|
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL connection (`knexfile.js`). `DB_NAME` is the database the app expects to already exist (see step 3). Note: `knexfile.js` does not read a port — Postgres must be on the default `5432`. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_TEMP_SECRET`, `JWT_RESET_SECRET` | Any random strings — generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | 32-byte hex (`openssl rand -hex 32`); encrypts stored statutory numbers. |
| `CLIENT_URL` | Comma-separated allowlist of frontend origins for CORS (default covers `localhost:5173–5175`). |
| `NODE_ENV` | Keep `development` locally — Knex only defines a `development` connection (see `knexfile.js`), and OTP/email codes are only echoed in API responses outside production. |

SMS and email default to `console` providers (codes/messages print to the server
log), so no gateway is needed to test login 2FA or forgot-password.

### 3. Create the database

Knex migrates an existing database — it does **not** create it. Create an empty
one matching `DB_NAME`:

```bash
createdb hris_db
# or: psql -U postgres -c "CREATE DATABASE hris_db;"
```

The logical schemas (`employee`, `role_permission`, `attendance`, `payroll`, …)
are created by the migrations, not by hand.

### 4. Run migrations

```bash
npx knex migrate:latest
```

This builds the entire schema (~50 migrations): employee/org tables, the
role/permission model, attendance, payroll, work schedules & holidays, documents,
face enrollment, kiosk devices, activity logs, system settings, and the
government-filing / employer-profile tables.

### 5. Run seeders

```bash
npx knex seed:run
```

Seeders run in filename order and are idempotent (safe to re-run):

| Seeder | Populates |
|---|---|
| `00_DefaultAdminSeeder.js` | The two immutable roles — **Administrator** (`is_deletable = false`) and the default employee role **User** (`is_default = true`, slug `user`) — plus the first-run admin account: an `employee.employees` row + `employee.credentials` row (bcrypt-hashed password) linked to the Administrator role. |
| `01_ModuleSeeeder.js` | The module catalog (admin + self-service feature areas). |
| `02_PermissionSeeder.js` | Every permission slug, derived from `src/database/constants/permissionMatrix.js`. |
| `03_RolePermissionSeeder.js` | Grants the immutable **Administrator** role every permission and the default employee role the `SELF_SERVICE` subset; prunes stale links. |

> **Default admin login** (created by `00_DefaultAdminSeeder.js`): `admin@hris.local`
> / `Admin@12345` — **change the password on first login.** Override before
> seeding with `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`,
> `DEFAULT_ADMIN_FIRST_NAME`, `DEFAULT_ADMIN_LAST_NAME`. The account is linked to
> the Administrator role, which `03_RolePermissionSeeder.js` grants every
> permission (including the `admin-console:access` and `employee-portal:access`
> login gates). All four seeders are idempotent.

### 6. Run the API and worker

```bash
npm run dev             # API on PORT (default 4000), nodemon
```

Background jobs (auto clock-out, absence marking, schedule backfill, retention
purges) run in a **separate** worker process:

```bash
npm run worker          # continuous, node-cron scheduled (SCHEDULER_ENABLED)
npm run worker:dev      # nodemon variant
npm run job <jobName>   # run a single job once, e.g. `npm run job backfillSchedule`
```

## Getting started (frontend)

```bash
cd hris/hris-frontend
npm install
# no .env.example — create .env with the vars below
npm run dev             # Vite dev server, default http://localhost:5173
```

Frontend env vars:

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API, e.g. `http://localhost:4000`. |
| `VITE_GOOGLE_CLIENT_ID` | Optional — only for Google sign-in. |

`CLIENT_URL` in the backend `.env` must include whichever origin(s) the frontend
runs on (CORS allowlist).

## Environment configuration

See `hris-backend/.env.example` for the full, documented list. Notable groups:

- **Core**: `PORT`, `NODE_ENV`, `CLIENT_URL`, DB connection, JWT secrets, `ENCRYPTION_KEY`
- **Company identity**: `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_LOGO_PATH` (printed on generated payslip PDFs)
- **OTP** (login 2FA + forgot-password): the code is sent over **every** channel on file — SMS (`src/utils/sms.js`, `SMS_PROVIDER`, still a console stub) **and** email — so a working `MAIL_PROVIDER` alone is enough. OTP TTL/attempts/cooldown also here.
- **Email**: `MAIL_PROVIDER` — `console` (logs, default) or `smtp` (real delivery via nodemailer; any SMTP provider). `smtp` needs `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`. Also `MAIL_FROM`, `ADMIN_CONTACT_EMAIL`. Drives login OTP, the contact-admin form, and employee notifications (document request raised, payslip-copy request fulfilled, payroll run approved — gated per employee by their notification preferences).
- **Employee portal**: `EMPLOYEE_PORTAL_URL` — base URL of the hris-user PWA, used for links in notification emails.
- **AWS S3** (employee document storage): `AWS_REGION`, `AWS_S3_BUCKET`, presign expiry, credentials
- **AWS Rekognition** (face recognition): enrollment/verification thresholds, Face Liveness role ARN, and the Attendance Kiosk's face collection (`FACE_REKOGNITION_COLLECTION_ID`)
- **Scheduler**: `SCHEDULER_ENABLED`, `SCHEDULER_TIMEZONE`, per-job cron expressions
- **Retention**: `RETENTION_PURGE_ENABLED` (master safety switch — jobs run report-only until this is `true`) and per-record retention horizons

## Backend structure

```
hris-backend/src/
├── database/
│   ├── migrations/    Knex schema migrations
│   ├── seeders/        Seed data (roles/permissions, lookups, etc.)
│   ├── models/         Objection.js models
│   └── constants/
├── module/
│   ├── admin/          Admin-console business logic (controller + services)
│   ├── auth/            Login, OTP, password reset, self-service profile
│   ├── user/             Employee self-service logic (shared with hris-user)
│   └── public/           Landing page / contact-admin endpoint
├── route/admin/         Admin API routes (see below)
├── middleware/           Auth guard, permission checks, validation, uploads
├── scheduler/jobs/       node-cron background jobs
└── utils/                sms.js, mailer.js, otp.js, notify.js, pdf generators, encryption, etc.
```

### Admin API modules (`route/admin/`)

| Route file | Covers |
|---|---|
| `employeeRoutes.js` | Employee directory, compensation, statutory/employment records |
| `attendanceRoutes.js` | Attendance records, clock-in/out corrections |
| `payrollRoutes.js` | Payroll runs, calc engine, payslip requests/PDF |
| `overtimeRequestRoutes.js` | Overtime filing/approval |
| `leaveRequestRoutes.js` | Leave filing/approval |
| `workScheduleRoutes.js` / `holidayRoutes.js` | Shift patterns + holiday calendar |
| `documentRoutes.js` | Employee document library + HR document requests (S3-backed) |
| `faceEnrollmentRoutes.js` / `faceLivenessRoutes.js` | Face recognition enrollment + liveness sessions (Rekognition) |
| `kioskRoutes.js` | Unattended Attendance Kiosk (1:N face identification) |
| `rolesAndPermissionRoutes.js` | Role/permission matrix administration |
| `reportsRoutes.js` | Report generation + CSV export |
| `dashboardRoutes.js` | Aggregate analytics for the admin landing page |
| `announcementRoutes.js` | Company announcements |
| `lookupRoutes.js` / `moduleRoutes.js` | Lookup/reference data + module (feature) settings |
| `activityLogRoutes.js` | Audit/activity log |

Government filing generators (BIR 2316/Alphalist, SSS R3, PhilHealth RF1,
Pag-IBIG MCRF) live under `module/admin` and are surfaced through the
Payroll/Reports areas — see in-app help; the generated forms are **not**
agency-certified and should be reviewed before submission.

## Frontend structure

```
hris-frontend/src/
├── pages/
│   ├── Employee/         Employee directory, comp, statutory, employment history
│   ├── Attendance/        Attendance records + corrections
│   ├── Payroll/            Payroll runs, payslip requests/PDF
│   ├── Overtime/           Overtime filing/approval
│   ├── Kiosk/               Attendance Kiosk UI
│   ├── Reports/             Tabbed reports + CSV export
│   ├── LookupSetting/       Lookup/reference data admin
│   ├── Maintenance/         Roles & Permissions, module settings, work schedules
│   ├── Announcement/
│   ├── DashboardHome.jsx    Recharts-based analytics landing page
│   ├── Landing.jsx / Login.jsx
├── layout/                 App shell (Dashboard.jsx = sidebar/topbar layout)
├── components/              Shared UI, incl. document/ and kiosk/ subsystems
├── api/ + services/          Axios client + endpoint wrappers
├── hooks/                    TanStack Query hooks
├── validation/                Yup schemas
└── utils/
```

## Key concepts

- **Permissions**: a role/scope allowlist matrix (`ADMIN` vs `SELF_SERVICE`
  scopes) drives both API authorization and frontend UI gating; managed via
  the Roles & Permissions admin page.
- **Face recognition**: AWS Rekognition powers both employee self-service
  verified clock-in (1:1 match) and the unattended Attendance Kiosk (1:N
  identification, liveness-gated). Requires an S3 face bucket, a Rekognition
  face collection, and an IAM role for Face Liveness — see the AWS S3 /
  Rekognition sections of `.env.example`.
- **Scheduler worker**: a separate long-running process (`npm run worker`)
  handles auto clock-out for forgotten punches, nightly absence marking, and
  data-retention purge jobs. `RETENTION_PURGE_ENABLED=false` keeps retention
  jobs in report-only (log, don't delete) mode until explicitly enabled.
- **Email / SMS**: outbound mail (`src/utils/mailer.js`) supports `console`
  (default, logs) and `smtp` (real, via nodemailer — any SMTP provider). SMS
  (`src/utils/sms.js`) is still a console-log stub. The login/reset **OTP**
  (`src/utils/otp.js`) fans out to both channels and succeeds if either
  delivers, so email alone is a working second factor. `src/utils/notify.js`
  sends the employee-facing notification emails (document request, payslip-copy
  fulfilled, payroll approved), honouring each employee's notification
  preferences. In dev, codes/messages print to the console and are echoed in the
  API response (`devCode` / `devPreview`).

## Scripts reference

**Backend**
```bash
npm run dev        # API, nodemon
npm start           # API, plain node
npm run worker       # scheduler worker, continuous
npm run worker:dev    # scheduler worker, nodemon
npm run job <name>     # run one scheduled job once
```

**Frontend**
```bash
npm run dev        # Vite dev server
npm run build        # production build
npm run preview       # preview a production build
npm run lint            # ESLint
```

## Related

- `hris-user` — separate repo: employee-facing self-service PWA (profile,
  government details, payslip requests, verified clock-in) consuming this
  same backend.
