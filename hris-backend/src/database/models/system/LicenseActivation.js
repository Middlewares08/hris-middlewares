// database/models/system/LicenseActivation.js
const bcrypt = require('bcrypt');
const BaseModel = require('../BaseModel');

class LicenseActivation extends BaseModel {
    static get tableName() { return 'system.license_activations'; }
    static get idColumn() { return 'id'; }

    async $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;

        // Caller passes the plaintext key in this field. One-way hashed here —
        // same protection as employee.credentials.password_hash — nothing in
        // the app ever needs the full key back; the license-server call
        // already happened straight from the request body before this insert.
        // `product_key_preview` (last 4 chars, plaintext) is the only thing a
        // masked display ever reads — not a meaningful secret on its own.
        if (this.product_key_hash) {
            const plain = String(this.product_key_hash);
            this.product_key_preview = plain.length <= 4 ? plain : plain.slice(-4);
            this.product_key_hash = await bcrypt.hash(plain, 12);
        }
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
    }

    /** Display-safe shape for the Maintenance "License" page — key is masked, never plaintext. */
    present() {
        const json = typeof this.toJSON === 'function' ? this.toJSON() : { ...this };
        return {
            uuid: json.uuid,
            productKeyMasked: json.product_key_preview ? `••••${json.product_key_preview}` : '••••',
            sentToEmail: json.sent_to_email,
            isStub: json.is_stub,
            licenseType: json.license_type,
            expiresAt: json.expires_at,
            isExpired: LicenseActivation.expired(json.expires_at),
            sentAt: json.sent_at,
            activatedAt: json.activated_at,
        };
    }

    /** null expires_at = perpetual, never expires. */
    static expired(expiresAt) {
        return !!expiresAt && new Date(expiresAt).getTime() < Date.now();
    }

    /** Marks the newest pending activation for this employee as complete (best-effort). */
    static async markActivated(employeeId, trx) {
        return LicenseActivation.query(trx)
            .where({ employee_id: employeeId })
            .whereNull('activated_at')
            .orderBy('id', 'desc')
            .limit(1)
            .patch({ activated_at: new Date().toISOString() });
    }

    /** The license currently governing this deployment — the most recent activation. */
    static current(trx) {
        return LicenseActivation.query(trx).orderBy('id', 'desc').first();
    }
}

module.exports = LicenseActivation;
