/**
 * Human-readable auto-generated employee identifier: EMP-<year>-<4-digit seq>,
 * where the sequence resets per calendar year. Generated in the application layer
 * on employee creation (see EmployeeController.createEmployee); this migration adds
 * the column and backfills existing rows.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.string('employee_id', 20).nullable().unique().index();
    });

    // Backfill: number existing rows per creation-year, ordered by created_at then id.
    await knex.raw(`
        UPDATE "employee"."employees" AS e
        SET employee_id = 'EMP-' || sub.yr || '-' || lpad(sub.seq::text, 4, '0')
        FROM (
            SELECT
                id,
                date_part('year', created_at)::int AS yr,
                row_number() OVER (
                    PARTITION BY date_part('year', created_at)
                    ORDER BY created_at, id
                ) AS seq
            FROM "employee"."employees"
        ) AS sub
        WHERE e.id = sub.id AND e.employee_id IS NULL;
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').alterTable('employees', (table) => {
        table.dropColumn('employee_id');
    });
};
