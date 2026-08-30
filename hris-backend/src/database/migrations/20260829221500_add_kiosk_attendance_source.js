/**
 * Allow 'kiosk' as an attendance source (the shared face-recognition kiosk),
 * alongside the existing web / mobile / biometric / manual.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
    await knex.raw(`
        ALTER TABLE attendance.attendance_logs
        DROP CONSTRAINT IF EXISTS attendance_logs_source_check
    `);
    await knex.raw(`
        ALTER TABLE attendance.attendance_logs
        ADD CONSTRAINT attendance_logs_source_check
        CHECK (source = ANY (ARRAY['web','mobile','biometric','manual','kiosk']::text[]))
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
    // Fold any kiosk rows back into 'biometric' so the tighter constraint applies.
    await knex('attendance.attendance_logs').where({ source: 'kiosk' }).update({ source: 'biometric' });
    await knex.raw(`
        ALTER TABLE attendance.attendance_logs
        DROP CONSTRAINT IF EXISTS attendance_logs_source_check
    `);
    await knex.raw(`
        ALTER TABLE attendance.attendance_logs
        ADD CONSTRAINT attendance_logs_source_check
        CHECK (source = ANY (ARRAY['web','mobile','biometric','manual']::text[]))
    `);
};
