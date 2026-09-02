/**
 * Persist the resolved shift + derived tardiness on each attendance log, so the
 * payroll engine, reports and dashboard read columns instead of re-deriving the
 * schedule (and instead of the old hard-coded 09:15 cutoff / Mon–Fri assumption).
 *
 * Populated at punch time (clock-in stamps the schedule; clock-out computes
 * late / undertime) and recomputed on an admin edit. Existing rows stay null
 * until the one-off backfill job runs.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('attendance').alterTable('attendance_logs', (table) => {
        table.bigInteger('schedule_id').unsigned().nullable()
            .references('id').inTable('attendance.work_schedules').onDelete('SET NULL');

        table.timestamp('scheduled_start', { useTz: true }).nullable();
        table.timestamp('scheduled_end', { useTz: true }).nullable();
        table.decimal('scheduled_hours', 5, 2).nullable();

        table.integer('late_minutes').notNullable().defaultTo(0);
        table.integer('undertime_minutes').notNullable().defaultTo(0);

        // The shift landed on a non-workday (rest day) / a holiday — punches on
        // these days never count as late/absent and feed OT logic instead.
        table.boolean('is_rest_day').notNullable().defaultTo(false);
        table.boolean('is_holiday').notNullable().defaultTo(false);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').alterTable('attendance_logs', (table) => {
        table.dropColumn('schedule_id');
        table.dropColumn('scheduled_start');
        table.dropColumn('scheduled_end');
        table.dropColumn('scheduled_hours');
        table.dropColumn('late_minutes');
        table.dropColumn('undertime_minutes');
        table.dropColumn('is_rest_day');
        table.dropColumn('is_holiday');
    });
};
