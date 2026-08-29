/**
 * Employee Document Portal:
 *   - `employee.document_requests` — HR asks an employee to submit a document
 *   - augments `employee.documents` with upload metadata + a link back to the request
 *   - seeds the `employee-documents` permission module (inside the migration to dodge
 *     the fragile seeder chain — see the payroll migrations for the same pattern)
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function(knex) {
    // 1. document_requests
    await knex.schema.withSchema('employee').createTable('document_requests', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.string('label').notNullable();          // "NBI Clearance", "Signed contract", ...
        table.string('note', 500).nullable();         // instructions for the employee
        table.date('due_date').nullable();

        table.enum('status', ['pending', 'fulfilled', 'cancelled']).notNullable().defaultTo('pending');
        table.bigInteger('fulfilled_document_id').unsigned().nullable()
            .references('id').inTable('employee.documents').onDelete('SET NULL');
        table.timestamp('fulfilled_at', { useTz: true }).nullable();

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted']);
        table.index(['status']);
    });

    // 2. upload metadata on documents
    await knex.schema.withSchema('employee').alterTable('documents', (table) => {
        table.string('file_name').nullable();
        table.bigInteger('size_bytes').nullable();
        table.string('source', 20).notNullable().defaultTo('admin'); // 'admin' | 'employee'
        table.bigInteger('document_request_id').unsigned().nullable()
            .references('id').inTable('employee.document_requests').onDelete('SET NULL');
    });

    // 3. seed the permission module (mirrors 01/02/03 seeders)
    const MODULE = {
        name: 'Employee Documents',
        slug: 'employee-documents',
        description: 'Employee document library and document requests.',
        access_type: 'ADMIN',
    };

    const [modRow] = await knex('role_permission.modules')
        .insert({ ...MODULE, created_by: 1 })
        .onConflict('slug').merge(['name', 'description', 'access_type'])
        .returning('id');
    const moduleId = modRow.id ?? modRow;

    const ACTIONS = [
        { action: 'view', prefix: 'View' },
        { action: 'create', prefix: 'Create' },
        { action: 'edit', prefix: 'Edit' },
        { action: 'delete', prefix: 'Delete' },
    ];
    const permissions = ACTIONS.map((a) => ({
        module_id: moduleId,
        action: a.action,
        name: `${a.prefix} ${MODULE.name}`,
        slug: `${MODULE.slug}:${a.action}`,
        description: `Allows you to ${a.action} the ${MODULE.name.toLowerCase()} module dashboard options.`,
        is_deleted: false,
        created_by: 1,
    }));
    await knex('role_permission.permissions')
        .insert(permissions)
        .onConflict('slug').merge(['action', 'name', 'description', 'module_id', 'is_deleted']);

    const adminRole = await knex('role_permission.roles').where({ is_deletable: false }).first();
    if (adminRole) {
        const permRows = await knex('role_permission.permissions')
            .whereIn('slug', permissions.map((p) => p.slug)).select('id');
        await knex('role_permission.role_permissions')
            .insert(permRows.map((p) => ({ role_id: adminRole.id, permission_id: p.id, created_by: 1 })))
            .onConflict(['role_id', 'permission_id']).ignore();
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function(knex) {
    await knex.schema.withSchema('employee').alterTable('documents', (table) => {
        table.dropColumn('document_request_id');
        table.dropColumn('file_name');
        table.dropColumn('size_bytes');
        table.dropColumn('source');
    });
    await knex.schema.withSchema('employee').dropTableIfExists('document_requests');

    const slugs = ['employee-documents:view', 'employee-documents:create', 'employee-documents:edit', 'employee-documents:delete'];
    const permRows = await knex('role_permission.permissions').whereIn('slug', slugs).select('id');
    if (permRows.length) {
        await knex('role_permission.role_permissions').whereIn('permission_id', permRows.map((p) => p.id)).del();
        await knex('role_permission.permissions').whereIn('slug', slugs).del();
    }
    await knex('role_permission.modules').where({ slug: 'employee-documents' }).del();
};
