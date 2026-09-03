// database/models/payroll/EmployerProfile.js
const BaseModel = require('../BaseModel');

const ROW_ID = 1;

const CATEGORIES = ['private', 'government'];

class EmployerProfile extends BaseModel {
    static get tableName() { return 'payroll.employer_profile'; }
    static get idColumn() { return 'id'; }

    static get ROW_ID() { return ROW_ID; }
    static get CATEGORIES() { return CATEGORIES; }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    /** The single profile row (creating it if the seed somehow never ran). */
    static async singleton(trx) {
        let row = await EmployerProfile.query(trx).findById(ROW_ID);
        if (!row) {
            row = await EmployerProfile.query(trx).insertAndFetch({ id: ROW_ID, business_category: 'private', tin_branch: '0000' });
        }
        return row;
    }

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
}

module.exports = EmployerProfile;
