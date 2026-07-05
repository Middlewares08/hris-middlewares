/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
    // 1. Clear out existing entries to prevent "duplicate key" errors on unique columns
    // Using TRUNCATE with CASCADE clears the data safely if other tables reference it
    await knex.raw('TRUNCATE TABLE role_permission.modules RESTART IDENTITY CASCADE;');
    const adminRole = await knex('role_permission.roles')
        .where({ is_deletable: false }) // Or check if your column is named 'is_deleted' / 'deletable'
        .first();

    // 2. Insert Core System Modules
    await knex('role_permission.modules').insert([
        {
            name: 'Dashboard',
            slug: 'dashboard',
            description: 'Overview analytics (headcount, attendance rate today, payroll cost graphs).',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Employees',
            slug: 'employee-management',
            description: 'Master Employee Directory, onboarding tracks, and department profiles.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },

        // ATTENDANCE
        {
            name: 'Time & Attendance',
            slug: 'time-and-attendance',
            description: 'Manage Time and Attendance for employees.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Attendance Logs',
            slug: 'attendance-logs',
            description: 'Daily time records sync.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Shift & Rostering',
            slug: 'shift-and-rostering',
            description: 'Schedules, holidays, rotations.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Leave Requests',
            slug: 'leave-request',
            description: 'Approvals, tracking leave balances.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Overtime Tracker',
            slug: 'overtime-tracker',
            description: 'Filing and manager approvals.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },

        // PAYROLL
        {
            name: 'Payroll & Compensation',
            slug: 'payroll-and-compensation',
            description: 'Manage Payroll and Compensation for employees.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Run Payroll',
            slug: 'run-payroll',
            description: 'Active processing, cutoff calculation, bank files.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Deductions Manager',
            slug: 'deduction-manage',
            description: 'Taxes, statutory benefits, cash advances.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Allowances & Bonuses',
            slug: 'allowance-and-bonuses',
            description: 'Incentives, taxable allowances, 13th month.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Salary Matrix',
            slug: 'salary-matrix',
            description: 'Pay scales and department grades.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },

        // SECURITY AND SETTING
        {
            name: 'Security & Settings',
            slug: 'attendance',
            description: 'Manage Security and Settings of your websites.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Roles & Permissions',
            slug: 'roles-and-permissions',
            description: 'Your RBAC custom profile mapping matrix.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'System Audit Logs',
            slug: 'system-audit-logs',
            description: 'The trace logs showing who edited what',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
    ]);
};