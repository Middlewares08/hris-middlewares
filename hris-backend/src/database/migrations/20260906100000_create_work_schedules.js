/**
 * Work schedules — the weekly shift pattern an employee is expected to work.
 *
 * Until now every piece of attendance math (late detection, undertime, "scheduled
 * days", the attendance-rate tile) implicitly assumed a fixed 8h / Mon–Fri office.
 * Anyone on a night shift, a 6-day week or part-time broke that math. These tables
 * make the expected shift explicit and per-employee.
 *
 *   work_schedules              — a named pattern (grace window, half-day threshold)
 *   work_schedule_days          — one row per weekday (0=Sun … 6=Sat, JS getDay)
 *   employee_schedule_assignments — effective-dated link employee → schedule
 *                                   (mirrors payroll.employee_compensations)
 *
 * A schedule flagged `is_default` is the org-wide fallback for anyone unassigned.
 * Night shift convention: a day row whose end_time <= start_time rolls the end to
 * the next calendar day; a log's `log_date` is the date the shift STARTS.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS attendance');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await knex.schema.withSchema('attendance').createTable('work_schedules', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.string('name', 120).notNullable();
        table.string('description', 500).nullable();

        // Minutes of lateness tolerated before a clock-in is flagged 'late'
        table.integer('grace_minutes').notNullable().defaultTo(0);
        // Net worked-hours below which a present day is downgraded to 'half_day'
        table.decimal('half_day_hours', 5, 2).notNullable().defaultTo(4);

        // Exactly one live row should carry this — the fallback when an employee
        // has no assignment (enforced by the partial unique index below).
        table.boolean('is_default').notNullable().defaultTo(false);
        table.boolean('is_active').notNullable().defaultTo(true);

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index(['is_deleted', 'is_active']);
    });

    // At most one default schedule among live rows.
    await knex.raw(`
        CREATE UNIQUE INDEX work_schedules_single_default
        ON attendance.work_schedules (is_default)
        WHERE is_default = true AND is_deleted = false
    `);

    await knex.schema.withSchema('attendance').createTable('work_schedule_days', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('schedule_id').unsigned().notNullable()
            .references('id').inTable('attendance.work_schedules').onDelete('CASCADE');

        // 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
        table.smallint('weekday').notNullable();
        table.boolean('is_workday').notNullable().defaultTo(false);
        table.time('start_time').nullable();
        table.time('end_time').nullable();
        table.integer('break_minutes').notNullable().defaultTo(60);

        table.unique(['schedule_id', 'weekday']);
        table.index(['schedule_id']);
    });

    await knex.schema.withSchema('attendance').createTable('employee_schedule_assignments', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');
        table.bigInteger('schedule_id').unsigned().notNullable()
            .references('id').inTable('attendance.work_schedules').onDelete('RESTRICT');

        table.date('effective_date').notNullable();
        table.date('end_date').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);

        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);

        table.index(['employee_id', 'is_deleted', 'is_active']);
        table.index(['effective_date']);
    });

    // --- Seed the default schedule: Mon–Fri 09:00–18:00, 1h break, 15-min grace ---
    // 09:00 + 15-min grace preserves the previous hard-coded 09:15 late cutoff.
    const inserted = await knex('attendance.work_schedules')
        .insert({
            name: 'Standard Day Shift',
            description: 'Monday to Friday, 9:00 AM – 6:00 PM with a 1-hour break. Applied to any employee without an explicit schedule assignment.',
            grace_minutes: 15,
            half_day_hours: 4,
            is_default: true,
            is_active: true,
        })
        .returning('id');
    const scheduleId = inserted[0].id ?? inserted[0];

    const days = [];
    for (let weekday = 0; weekday <= 6; weekday += 1) {
        const isWorkday = weekday >= 1 && weekday <= 5; // Mon–Fri
        days.push({
            schedule_id: scheduleId,
            weekday,
            is_workday: isWorkday,
            start_time: isWorkday ? '09:00:00' : null,
            end_time: isWorkday ? '18:00:00' : null,
            break_minutes: 60,
        });
    }
    await knex('attendance.work_schedule_days').insert(days);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').dropTableIfExists('employee_schedule_assignments');
    await knex.schema.withSchema('attendance').dropTableIfExists('work_schedule_days');
    await knex.schema.withSchema('attendance').dropTableIfExists('work_schedules');
};
