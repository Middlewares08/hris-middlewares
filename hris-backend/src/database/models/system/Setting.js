// database/models/system/Setting.js
const BaseModel = require('../BaseModel');

/**
 * Known settings keys and their defaults. Anything not listed here is rejected by
 * the update endpoint, so the surface stays small and typo-proof.
 */
const REGISTRY = {
    'overtime.enabled': { type: 'boolean', default: true, public: true },
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
