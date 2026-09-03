const bcrypt = require('bcrypt');
const { ACTIVE_PERMISSION_SLUGS } = require('../constants/permissionMatrix');

/**
 * First-run bootstrap.
 *
 * Creates the two immutable RBAC roles the rest of the system assumes already
 * exist, then provisions a single default administrator account wired to the
 * Administrator role (which carries every permission).
 *
 *   1. `Administrator` role  — `is_deletable = false`, `is_default = false`.
 *                              Gets EVERY active permission. Cannot be deleted or
 *                              have its grants edited from the admin UI
 *                              (see RolePermissionController).
 *   2. `User` role           — `is_deletable = false`, `is_default = true`.
 *                              The role every new employee is auto-assigned
 *                              (see Employee.$afterInsert / EmployeeController).
 *                              Its self-service grants are filled in by
 *                              03_RolePermissionSeeder.
 *   3. Default admin employee + login credentials + Administrator role link.
 *
 * Everything here is idempotent — safe to run on every `knex seed:run`.
 *
 * Runs FIRST (00_) so 01_ModuleSeeeder / 03_RolePermissionSeeder can resolve the
 * immutable roles. The bulk permission grant below is also performed by
 * 03_RolePermissionSeeder; it is repeated here so this seeder alone is enough to
 * (re)build a working admin once modules + permissions exist.
 *
 * Override the defaults with env vars:
 *   DEFAULT_ADMIN_EMAIL       (default: admin@hris.local)
 *   DEFAULT_ADMIN_PASSWORD    (default: Admin@12345 — change on first login)
 *   DEFAULT_ADMIN_FIRST_NAME  (default: System)
 *   DEFAULT_ADMIN_LAST_NAME   (default: Administrator)
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    const admin = {
        email: (process.env.DEFAULT_ADMIN_EMAIL || 'admin@hris.local').toLowerCase().trim(),
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345',
        firstName: process.env.DEFAULT_ADMIN_FIRST_NAME || 'System',
        lastName: process.env.DEFAULT_ADMIN_LAST_NAME || 'Administrator',
    };

    const IMMUTABLE_ROLES = [
        {
            name: 'Administrator',
            slug: 'administrator',
            description: 'Full, non-editable system access. Holds every permission.',
            is_deletable: false,
            is_default: false,
        },
        {
            name: 'User',
            slug: 'user',
            description: 'Default role automatically assigned to every employee (self-service scope).',
            is_deletable: false,
            is_default: true,
        },
    ];

    // ------------------------------------------------------------------ 1. Roles
    for (const role of IMMUTABLE_ROLES) {
        const existing = await knex('role_permission.roles').where({ slug: role.slug }).first();

        if (!existing) {
            await knex('role_permission.roles').insert({
                ...role,
                is_deleted: false,
                created_by: null,
                updated_by: null,
            });
            console.log(`[SEED] Created immutable role: ${role.name}`);
        } else {
            // Keep the protection flags in sync without touching anything else.
            await knex('role_permission.roles')
                .where({ id: existing.id })
                .update({
                    is_deletable: role.is_deletable,
                    is_default: role.is_default,
                    is_deleted: false,
                });
            console.log(`[SEED] Verified immutable role: ${role.name}`);
        }
    }

    const adminRole = await knex('role_permission.roles').where({ slug: 'administrator' }).first();

    // ---------------------------------------------- 2. Administrator -> every permission
    const permissions = await knex('role_permission.permissions')
        .select('id')
        .where({ is_deleted: false })
        .whereIn('slug', ACTIVE_PERMISSION_SLUGS);

    if (permissions.length === 0) {
        console.warn(
            '⚠️  No permissions found yet — 02_PermissionSeeder / 03_RolePermissionSeeder will grant them to Administrator.',
        );
    } else {
        await knex('role_permission.role_permissions')
            .insert(
                permissions.map((perm) => ({
                    role_id: adminRole.id,
                    permission_id: perm.id,
                    is_deleted: false,
                    created_by: null,
                    updated_by: null,
                })),
            )
            .onConflict(['role_id', 'permission_id'])
            .ignore();
        console.log(`💪 Granted ${permissions.length} permissions to Administrator (Role ID: ${adminRole.id}).`);
    }

    // ------------------------------------------------------- 3. Default admin account
    const existingCredential = await knex('employee.credentials').where({ email: admin.email }).first();

    let adminEmployeeId = existingCredential?.employee_id;

    if (existingCredential) {
        console.log(`[SEED] Default admin "${admin.email}" already exists — skipping account creation.`);
    } else {
        await knex.transaction(async (trx) => {
            const [employee] = await trx('employee.employees')
                .insert({
                    first_name: admin.firstName,
                    last_name: admin.lastName,
                    preferred_name: 'Admin',
                    is_active: true,
                    is_deleted: false,
                })
                .returning('id');

            adminEmployeeId = employee.id ?? employee;

            // Human-readable id — only claim EMP-<year>-0001 if it is still free.
            const year = new Date().getFullYear();
            const humanId = `EMP-${year}-0001`;
            const taken = await trx('employee.employees').where({ employee_id: humanId }).first();
            if (!taken) {
                await trx('employee.employees').where({ id: adminEmployeeId }).update({ employee_id: humanId });
            }

            await trx('employee.contacts').insert({
                employee_id: adminEmployeeId,
                personal_email: admin.email,
                personal_phone: '+630000000000',
                emergency_contact_name: 'System Fallback',
                emergency_contact_relationship: 'Other',
                emergency_contact_phone: '+630000000000',
            });

            await trx('employee.demographics').insert({
                employee_id: adminEmployeeId,
                date_of_birth: '1970-01-01',
                gender: 'Prefer not to say',
                nationality: 'System',
            });

            await trx('employee.credentials').insert({
                employee_id: adminEmployeeId,
                email: admin.email,
                // Match Credential model hashing (bcrypt, 12 rounds).
                password_hash: await bcrypt.hash(admin.password, 12),
            });
        });

        console.log('\n============================================================');
        console.log('  DEFAULT ADMIN CREATED');
        console.log(`  email    : ${admin.email}`);
        console.log(
            process.env.DEFAULT_ADMIN_PASSWORD
                ? '  password : (from DEFAULT_ADMIN_PASSWORD env var)'
                : `  password : ${admin.password}   <-- change this on first login`,
        );
        console.log('============================================================\n');
    }

    // --------------------------------------------------- 4. Link account -> Administrator
    if (adminEmployeeId) {
        await knex('role_permission.employee_roles')
            .insert({
                employee_id: adminEmployeeId,
                role_id: adminRole.id,
                is_deleted: false,
                created_by: null,
                updated_by: null,
            })
            .onConflict(['employee_id', 'role_id'])
            .ignore();
        console.log(`[SEED] Linked admin employee (ID: ${adminEmployeeId}) to the Administrator role.`);
    }
};
