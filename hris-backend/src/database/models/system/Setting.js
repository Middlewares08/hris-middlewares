// database/models/system/Setting.js
const BaseModel = require('../BaseModel');

/**
 * Known settings keys and their defaults. Anything not listed here is rejected by
 * the update endpoint, so the surface stays small and typo-proof.
 */
const REGISTRY = {
    'overtime.enabled': { type: 'boolean', default: true, public: true },
    // Annual paid-leave credits an employee accrues (vacation/sick/emergency draw from this).
    // Drives the employee dashboard "Leave Balance" tile: remaining = credits - days approved this year.
    'leave.annual_credits': { type: 'number', default: 15, public: true },
    // When on, an enrolled employee must pass face verification to clock in/out.
    // Employees without an active face enrollment are unaffected (gradual rollout).
    'face.clockin_enabled': { type: 'boolean', default: false, public: true },
    // When on (and face.clockin_enabled is on, and FACE_LIVENESS_ROLE_ARN is set),
    // the face check is an active liveness challenge rather than a single photo.
    'face.liveness_enabled': { type: 'boolean', default: false, public: true },
    // Master switch for the shared attendance kiosk (1:N face identification).
    // Admin-only: the kiosk reads it through its own token-authed /kiosk/config.
    'face.kiosk_enabled': { type: 'boolean', default: false, public: false },
    // When on (default), a kiosk punch must pass a Face Liveness challenge before its
    // reference frame is used for 1:N search — rejects a printed-photo spoof. When off,
    // the kiosk accepts a plain photo frame instead, with no anti-spoof check.
    // Admin-only: the kiosk reads it through its own token-authed /kiosk/config.
    'face.kiosk_liveness_enabled': { type: 'boolean', default: true, public: false },
    // When on, recording a separation with a last_working_day (or separation_date,
    // if that's unset) in the future leaves the employee active/payable until that
    // date; the daily processSeparations job flips them inactive once it arrives.
    // When off, restores the old behaviour: inactivate immediately on record creation.
    'separation.defer_inactivation': { type: 'boolean', default: true, public: false },
    // Master switch for the nightly autoClockOut job (see scheduler/jobs/autoClockOut.js).
    // When on (default), forgotten time-outs older than AUTO_CLOCK_OUT_MIN_OPEN_HOURS are
    // stamped closed automatically. When off, the job is a no-op — open punches stay open
    // for a manager to close manually. Admin-only: no employee-facing effect either way.
    'attendance.auto_clock_out_enabled': { type: 'boolean', default: true, public: false },
    // Master switch for the first-time Setup Wizard (see SetupController). When on,
    // an admin whose required setup steps aren't done yet is redirected to the
    // wizard on login. Turning this off retires the wizard permanently — e.g. once
    // the org is fully onboarded, or an admin just wants it out of the way.
    'setup.wizard_enabled': { type: 'boolean', default: true, public: false },
    // How strictly an expired license is enforced (src/utils/licenseGuard.js).
    // true (hard): every authenticated request is rejected in real time the
    // instant the license expires — an already-open session gets kicked out.
    // false (soft): only new logins are blocked; an already-open session keeps
    // working until it separately expires. Configurable because this genuinely
    // depends on the licensing contract, not a fixed product decision.
    'license.hard_enforcement': { type: 'boolean', default: true, public: false },
    // Flips true once the public Install Wizard (src/module/public/install.controller.js)
    // has created the first admin account. Read unauthenticated (GET /public/install/status)
    // to decide whether a fresh visitor gets routed to the install wizard at all — the
    // single source of truth for "is this deployment set up yet", independent of whether
    // that admin account later gets deleted.
    'install.completed': { type: 'boolean', default: false, public: false },
};

class Setting extends BaseModel {
    static get tableName() { return 'system.settings'; }
    static get idColumn() { return 'id'; }

    static get REGISTRY() { return REGISTRY; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    /** Raw value for a key, or the registry/explicit fallback. `trx` optional. */
    static async get(key, fallback = undefined, trx) {
        const row = await Setting.query(trx).findOne({ key });
        if (!row) return fallback !== undefined ? fallback : REGISTRY[key]?.default;
        return row.value?.value;
    }

    /** Boolean-coerced convenience reader — used by the payroll engine and routes. */
    static async getBool(key, fallback = false, trx) {
        const raw = await Setting.get(key, fallback, trx);
        return raw === true || raw === 'true' || raw === 1;
    }

    /** Upsert a key. Returns the persisted row. */
    static async set(key, value, actorId = null, trx) {
        const existing = await Setting.query(trx).findOne({ key });
        const patch = {
            value: { value },
            updated_by: actorId,
            updated_at: new Date().toISOString(),
        };
        if (existing) {
            return Setting.query(trx).patchAndFetchById(existing.id, patch);
        }
        return Setting.query(trx).insertAndFetch({
            key,
            value: { value },
            is_public: !!REGISTRY[key]?.public,
            updated_by: actorId,
        });
    }
}

module.exports = Setting;
