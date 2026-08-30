/**
 * Let a Face Liveness session belong to a kiosk device instead of an employee.
 * Kiosk challenges are anonymous until the post-challenge SearchFacesByImage
 * identifies the person, so `employee_id` becomes nullable and we track which
 * kiosk opened the session.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.schema.withSchema('attendance').alterTable('face_liveness_sessions', (table) => {
        table.bigInteger('employee_id').unsigned().nullable().alter();
        table.bigInteger('kiosk_device_id').unsigned().nullable()
            .references('id').inTable('attendance.kiosk_devices').onDelete('SET NULL');
        table.index(['kiosk_device_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('attendance').alterTable('face_liveness_sessions', (table) => {
        table.dropColumn('kiosk_device_id');
    });
    // Leaving employee_id nullable on rollback is harmless; re-tightening it would
    // fail if any kiosk rows exist.
};
