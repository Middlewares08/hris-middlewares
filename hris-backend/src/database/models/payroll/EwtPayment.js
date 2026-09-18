// database/models/payroll/EwtPayment.js
const AuditModel = require('./AuditModel');

class EwtPayment extends AuditModel {
    static get tableName() { return 'payroll.ewt_payments'; }
    static get idColumn() { return 'id'; }

    static get relationMappings() {
        const EwtPayee = require('./EwtPayee');
        return {
            payee: {
                relation: AuditModel.BelongsToOneRelation,
                modelClass: EwtPayee,
                join: {
                    from: 'payroll.ewt_payments.payee_id',
                    to: 'payroll.ewt_payees.id',
                },
            },
        };
    }
}

module.exports = EwtPayment;
