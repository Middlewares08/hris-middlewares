/**
 * The canonical list of permissions the application actually enforces, split by
 * where they apply:
 *
 *   ADMIN         -> the admin console (hris-frontend) — guarded by
 *                    `requirePermission(...)` on the /admin-facing routes and by
 *                    `can(...)` / `permission=` gates in hris-frontend.
 *   SELF_SERVICE  -> the employee PWA (hris-user) — guarded by
 *                    `requirePermission('my-*:*')` on the self-service routes
 *                    (`/auth/me/*`, `/documents/me`, `/leave-requests/me`, …) and
 *                    by `can(...)` in hris-user.
 *
 * A slug that used to be auto-generated for every module/action pair but is NOT
 * listed here is dead weight and gets soft-deleted (`is_deleted = true`).
 *
 * This is the single source of truth shared by:
 *   - src/database/seeders/01_ModuleSeeeder.js       (SELF_SERVICE module rows)
 *   - src/database/seeders/02_PermissionSeeder.js    (which permissions exist)
 *   - src/database/seeders/03_RolePermissionSeeder.js (admin role vs default role grants)
 *   - src/database/migrations/2026090212*_*.js        (one-time prune / seed)
 *   - src/module/admin/controller/roles-and-permission/RolePermissionController.js
 */

const ACCESS_TYPES = {
    ADMIN: 'ADMIN',
    SELF_SERVICE: 'SELF_SERVICE',
};

// Admin-console permissions — module slug -> enforced actions.
const ADMIN_PERMISSION_MATRIX = {
    'admin-console': ['access'], // gate: may sign in to the admin dashboard (hris-frontend)
    'dashboard': ['view'],
    'reports': ['view'],
    'employee-management': ['view', 'create', 'edit', 'delete'],
    'attendance-logs': ['view', 'create', 'edit', 'delete'],
    'attendance-kiosk': ['view', 'create', 'edit', 'delete'],
    'shift-and-rostering': ['view', 'create', 'edit', 'delete'], // work schedules + holiday calendar
    'face-recognition': ['view', 'create', 'edit', 'delete'],
    'leave-request': ['view', 'edit', 'delete'],
    'overtime-tracker': ['view', 'edit', 'delete'],
    'payroll-and-compensation': ['view', 'create', 'edit', 'delete'],
    'run-payroll': ['view', 'create', 'edit', 'delete'],
    'government-forms': ['view', 'generate'], // BIR 2316/Alphalist, SSS R3, PhilHealth RF1, Pag-IBIG MCRF
    'statutory-and-compliance': ['view', 'create', 'edit', 'delete'],
    'roles-and-permissions': ['view', 'create', 'edit', 'delete'],
    'announcements': ['view', 'create', 'edit', 'delete'],
    'maintenance': ['view', 'edit'],
    'positions': ['view', 'create', 'edit', 'delete'],
    'departments': ['view', 'create', 'edit', 'delete'],
    'benefits': ['view', 'edit', 'delete'],
    'resume': ['view', 'create', 'edit', 'delete'],
    'employee-documents': ['view', 'create', 'edit', 'delete'],
    'identifications': ['view'],
};

// Employee self-service (PWA) permissions — module slug -> enforced actions.
const SELF_SERVICE_PERMISSION_MATRIX = {
    'employee-portal': ['access'], // gate: may sign in to the employee PWA (hris-user)
    'my-profile': ['view', 'edit'],
    'my-attendance': ['view', 'create'],
    'my-payslips': ['view', 'create'],
    'my-documents': ['view', 'create'],
    'my-leave': ['view', 'create', 'edit'],
    'my-overtime': ['view', 'create', 'edit'],
    'my-government-details': ['view', 'edit'],
};

// Metadata for the SELF_SERVICE module rows (01_ModuleSeeeder + the seed migration).
const SELF_SERVICE_MODULES = [
    { name: 'Employee Portal', slug: 'employee-portal', description: 'Controls whether an account can sign in to the employee mobile app at all.' },
    { name: 'My Profile', slug: 'my-profile', description: 'Employee edits their own contact details, address, emergency contact and app preferences.' },
    { name: 'My Attendance', slug: 'my-attendance', description: 'Employee clocks in/out and reviews their own daily time records.' },
    { name: 'My Payslips', slug: 'my-payslips', description: 'Employee views their own payslips and files official payslip-copy requests.' },
    { name: 'My Documents', slug: 'my-documents', description: 'Employee document library plus requests submitted to HR.' },
    { name: 'My Leave', slug: 'my-leave', description: 'Employee files, edits and cancels their own leave requests.' },
    { name: 'My Overtime', slug: 'my-overtime', description: 'Employee files, edits and cancels their own overtime requests.' },
    { name: 'My Government & Bank', slug: 'my-government-details', description: 'Employee manages their own SSS/PhilHealth/Pag-IBIG/TIN and payroll bank account.' },
];

// Metadata for the extra ADMIN module rows that 01_ModuleSeeeder doesn't already carry.
const EXTRA_ADMIN_MODULES = [
    { name: 'Admin Console', slug: 'admin-console', description: 'Controls whether an account can sign in to the admin dashboard at all.' },
];

const ACTION_LABELS = {
    access: 'Access',
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
};

const toSlugs = (matrix) =>
    Object.entries(matrix).flatMap(([moduleSlug, actions]) => actions.map((action) => `${moduleSlug}:${action}`));

const ADMIN_PERMISSION_SLUGS = toSlugs(ADMIN_PERMISSION_MATRIX);
const SELF_SERVICE_PERMISSION_SLUGS = toSlugs(SELF_SERVICE_PERMISSION_MATRIX);

// Everything that should exist, regardless of scope.
const ACTIVE_PERMISSION_MATRIX = { ...ADMIN_PERMISSION_MATRIX, ...SELF_SERVICE_PERMISSION_MATRIX };
const ACTIVE_PERMISSION_SLUGS = [...ADMIN_PERMISSION_SLUGS, ...SELF_SERVICE_PERMISSION_SLUGS];

// module slug -> access_type, for the seeders/migrations.
const MODULE_ACCESS_TYPE = Object.fromEntries([
    ...Object.keys(ADMIN_PERMISSION_MATRIX).map((slug) => [slug, ACCESS_TYPES.ADMIN]),
    ...Object.keys(SELF_SERVICE_PERMISSION_MATRIX).map((slug) => [slug, ACCESS_TYPES.SELF_SERVICE]),
]);

module.exports = {
    ACCESS_TYPES,
    ACTION_LABELS,
    ADMIN_PERMISSION_MATRIX,
    SELF_SERVICE_PERMISSION_MATRIX,
    SELF_SERVICE_MODULES,
    EXTRA_ADMIN_MODULES,
    ADMIN_PERMISSION_SLUGS,
    SELF_SERVICE_PERMISSION_SLUGS,
    ACTIVE_PERMISSION_MATRIX,
    ACTIVE_PERMISSION_SLUGS,
    MODULE_ACCESS_TYPE,
};
