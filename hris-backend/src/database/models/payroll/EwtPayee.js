// database/models/payroll/EwtPayee.js
const AuditModel = require('./AuditModel');

const PAYEE_TYPES = ['individual', 'non_individual'];

class EwtPayee extends AuditModel {
    static get tableName() { return 'payroll.ewt_payees'; }
    static get idColumn() { return 'id'; }

    static get PAYEE_TYPES() { return PAYEE_TYPES; }

    /** Formatted one-line registered address. */
    fullAddress() {
        return [this.address_line1, this.address_line2, this.city, this.province, this.zip_code]
            .map((s) => (s ? String(s).trim() : ''))
            .filter(Boolean)
            .join(', ');
    }

    /** TIN as 9 digits + 3-digit branch, digits only (filing format). */
    tinDigits() {
        const base = String(this.tin || '').replace(/\D/g, '').padStart(9, '0').slice(0, 9);
        const branch = String(this.tin_branch || '0000').replace(/\D/g, '').padStart(3, '0').slice(-3);
        return { base, branch, joined: `${base}${branch}` };
    }

    static get relationMappings() {
        const EwtPayment = require('./EwtPayment');
        return {
            payments: {
                relation: AuditModel.HasManyRelation,
                modelClass: EwtPayment,
                join: {
                    from: 'payroll.ewt_payees.id',
                    to: 'payroll.ewt_payments.payee_id',
                },
            },
        };
    }
}

module.exports = EwtPayee;
