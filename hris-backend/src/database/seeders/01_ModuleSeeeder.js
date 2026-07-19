/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
    // 1. Fetch the immutable admin role reference safely
    const adminRole = await knex('role_permission.roles')
        .where({ is_deletable: false })
        .first();

    // 2. Define the Core System Modules Matrix Blueprint
    const modulesToSeed = [
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
        {
            name: 'Maintenance',
            slug: 'maintenance',
            description: 'Core system maintenance workspace structures and foundational business configurations.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Lookups Setting',
            slug: 'lookups-setting',
            description: 'Manage global dropdown variables, system classification rules, and metadata keys used across the platform.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Positions',
            slug: 'positions',
            description: 'Company-wide job catalog, career tracks, responsibilities, and associated operational titles.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Departments',
            slug: 'departments',
            description: 'Organizational department boundaries, operational cost centers, and department leadership mapping.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Pay Grades',
            slug: 'pay-grades',
            description: 'Salary structures, bracket floors and ceilings, and statutory compensation grade levels.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Statutory and Compliance',
            slug: 'statutory-and-compliance',
            description: 'Government contributions, tax tables, statutory brackets, and regulatory compliance settings.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Identifications',
            slug: 'identifications',
            description: 'Employee verification records, passport details, government-issued IDs, and license tracking.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Benefits',
            slug: 'benefits',
            description: 'Company-sponsored perks, healthcare plans, allowances, and enrollment program configurations.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        },
        {
            name: 'Resumé',
            slug: 'resume',
            description: 'Work history records, educational credentials, skill sets, and digital document attachments.',
            access_type: 'ADMIN',
            created_by: 1,
            updated_by: null
        }
    ];

    // 3. Loop through individual nodes and execute lookups
    for (const moduleItem of modulesToSeed) {
        // Look up by the unique slug identifier
        const existingModule = await knex('role_permission.modules')
            .where({ slug: moduleItem.slug })
            .first();

        if (!existingModule) {
            // Safe to insert since it doesn't cross unique constraints
            await knex('role_permission.modules').insert(moduleItem);
            console.log(`[SEED] Inserted module: ${moduleItem.name} (${moduleItem.slug})`);
        } else {
            // Skips seamlessly, leaving current settings untouched
            console.log(`[SEED] Skipped module (Already Exists): ${moduleItem.name}`);
        }
    }
};