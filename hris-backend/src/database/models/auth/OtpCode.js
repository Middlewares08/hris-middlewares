const BaseModel = require('../BaseModel');

class OtpCode extends BaseModel {
    static get tableName() { return 'auth.otp_codes'; }
    static get idColumn() { return 'id'; }

    static get PURPOSES() {
        return { LOGIN_2FA: 'login_2fa', PASSWORD_RESET: 'password_reset' };
    }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
    }

    get isExpired() {
        return new Date(this.expires_at).getTime() <= Date.now();
    }

    get isConsumed() {
        return !!this.consumed_at;
    }

    get isLocked() {
        return this.attempts >= this.max_attempts;
    }
}

module.exports = OtpCode;
