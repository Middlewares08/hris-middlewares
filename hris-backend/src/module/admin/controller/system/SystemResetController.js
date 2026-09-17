// src/module/admin/controller/system/SystemResetController.js
//
// "Start Fresh" — wipes every application table and re-seeds a blank install
// (immutable roles only — no admin account, since 00_DefaultAdminSeeder no
// longer creates one). The next visitor to hris-frontend is routed straight
// to the public Install Wizard (see install.controller.js) to create the
// first admin again, exactly like a brand-new deployment. Extremely
// destructive and irreversible. Three independent gates must all pass before
// a single row is touched:
//   1. ALLOW_DB_RESET=true in the server's own environment (off by default —
//      never settable from the client, so a compromised/careless admin
//      session can't flip it).
//   2. The caller re-enters their own current password.
//   3. The caller types their own account email as a confirmation phrase.
const connection = require('../../../../database/connection');
const Credential = require('../../../../database/models/employee/Credential');

// Every schema that holds real application data. Deliberately excludes
// `public` (knex's own migrations bookkeeping) and the unused legacy
// `roles_permissions` schema (superseded by `role_permission`, never read or
// written by any code — left alone rather than guessed at).
const LIVE_SCHEMAS = ['employee', 'attendance', 'payroll', 'role_permission', 'system', 'auth', 'announcement', 'lookups'];

// Re-seeded in this exact order after the wipe — mirrors `npx knex seed:run`.
const RESEED_ORDER = [
    '../../../../database/seeders/00_DefaultAdminSeeder',
    '../../../../database/seeders/01_ModuleSeeeder',
    '../../../../database/seeders/02_PermissionSeeder',
    '../../../../database/seeders/03_RolePermissionSeeder',
];

const isResetAllowed = () => process.env.ALLOW_DB_RESET === 'true';

const resetDatabase = async (req, res) => {
    try {
        if (!isResetAllowed()) {
            return res.status(403).json({
                success: false,
                message: 'Database reset is disabled on this server (ALLOW_DB_RESET is not set to true).',
            });
        }

        const { password, confirmEmail } = req.body || {};
        if (!password || !confirmEmail) {
            return res.status(400).json({ success: false, message: 'password and confirmEmail are both required.' });
        }

        const credential = await Credential.query().findOne({ employee_id: req.user.id });
        if (!credential) {
            return res.status(401).json({ success: false, message: 'Could not verify your account.' });
        }

        const passwordOk = await credential.verifyPassword(password);
        if (!passwordOk) {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }

        const emailMatches = String(confirmEmail).trim().toLowerCase() === String(credential.email).trim().toLowerCase();
        if (!emailMatches) {
            return res.status(400).json({ success: false, message: 'Confirmation email does not match your account email.' });
        }

        // The DB is about to be wiped, so this is the only durable record of who
        // did it — the server console/process log, not a table.
        console.warn(
            `\n🚨 DATABASE RESET requested by ${credential.email} (employee #${req.user.id}) `
            + `at ${new Date().toISOString()} from IP ${req.ip}\n`,
        );

        const { rows: tables } = await connection.raw(
            `SELECT table_schema, table_name FROM information_schema.tables
             WHERE table_schema = ANY(?) AND table_type = 'BASE TABLE'`,
            [LIVE_SCHEMAS],
        );

        if (tables.length === 0) {
            // Should never happen — refuse rather than silently no-op.
            return res.status(500).json({ success: false, message: 'No application tables were found — refusing to reset.' });
        }

        const tableList = tables.map((t) => `"${t.table_schema}"."${t.table_name}"`).join(', ');

        // One statement: CASCADE lets Postgres resolve FK ordering across all
        // ~40 tables itself, so this doesn't have to hand-maintain a dependency
        // order that would silently go stale the next time a migration adds a table.
        await connection.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

        for (const seederPath of RESEED_ORDER) {
            // eslint-disable-next-line global-require, import/no-dynamic-require
            await require(seederPath).seed(connection);
        }

        // No admin account exists to attach an activity-log row to any more (that
        // table was just wiped along with everything else) — the console.warn
        // banners above/below are the only durable record of who did this.
        console.warn('✅ DATABASE RESET complete — roles re-seeded, no admin account. Next visitor must complete /install.\n');

        return res.status(200).json({
            success: true,
            message: 'Database reset complete. Every record was wiped and the system re-seeded to a blank install — no admin account exists any more.',
            data: {
                note: 'Visit /install to activate this deployment and create the first admin account again.',
            },
        });
    } catch (error) {
        console.error('Database reset error:', error);
        return res.status(500).json({ success: false, message: 'Server error while resetting the database. Check server logs — the database may be left partially reset.' });
    }
};

module.exports = { resetDatabase };
