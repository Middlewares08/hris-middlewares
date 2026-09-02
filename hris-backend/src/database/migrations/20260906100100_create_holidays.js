/**
 * Holiday calendar. Absence detection and the attendance-rate denominators need
 * to know which calendar days are non-working — otherwise every employee reads as
 * "absent" on a holiday. Also lets a log be stamped `status = 'holiday'`.
 *
 * `type` mirrors the PH DOLE categories (drives holiday pay rules later; not used
 * by the attendance math itself, which only cares that the day is non-working):
 *   regular              — regular holiday (e.g. Christmas, Independence Day)
 *   special_non_working  — special non-working day
 *   special_working      — special working day (still a work day; kept for record)
 *
 * Seeds the PH 2026 nationwide fixed-date holidays as labelled defaults. Movable
 * Islamic holidays (Eid'l Fitr / Eid'l Adha) are proclaimed each year — add them
 * via the admin calendar. Verify against the official proclamation before a live
 * payroll run.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('holidays', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.date('date').notNullable();
        table.string('name', 160).notNullable();
        table.enum('type', ['regular', 'special_non_working', 'special_working'])
            .notNullable().defaultTo('regular');
        table.boolean('is_active').notNullable().defaultTo(true);

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.unique(['date', 'name']);
        table.index(['date']);
    });

    const holidays2026 = [
        ['2026-01-01', "New Year's Day", 'regular'],
        ['2026-04-02', 'Maundy Thursday', 'regular'],
        ['2026-04-03', 'Good Friday', 'regular'],
        ['2026-04-04', 'Black Saturday', 'special_non_working'],
        ['2026-04-09', 'Araw ng Kagitingan', 'regular'],
        ['2026-05-01', 'Labor Day', 'regular'],
        ['2026-06-12', 'Independence Day', 'regular'],
        ['2026-08-21', 'Ninoy Aquino Day', 'special_non_working'],
        ['2026-08-31', 'National Heroes Day', 'regular'],
        ['2026-11-01', "All Saints' Day", 'special_non_working'],
        ['2026-11-02', "All Souls' Day", 'special_non_working'],
        ['2026-11-30', 'Bonifacio Day', 'regular'],
        ['2026-12-08', 'Feast of the Immaculate Conception', 'special_non_working'],
        ['2026-12-24', 'Christmas Eve', 'special_non_working'],
        ['2026-12-25', 'Christmas Day', 'regular'],
        ['2026-12-30', 'Rizal Day', 'regular'],
        ['2026-12-31', 'Last Day of the Year', 'special_non_working'],
    ];
    await knex('attendance.holidays').insert(
        holidays2026.map(([date, name, type]) => ({ date, name, type })),
    );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('holidays');
};
