// src/module/admin/controller/payroll/EwtPaymentController.js
const EwtPayee = require('../../../../database/models/payroll/EwtPayee');
const EwtPayment = require('../../../../database/models/payroll/EwtPayment');
const { atcByCode } = require('../../../../database/constants/atcCodes');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    actorId, withActor, ok, created, fail, serverError,
    isValidDate, isValidNumber, trimOrNull, definedOnly,
} = require('./_helpers');

const listForPayee = async (req, res) => {
    try {
        const payee = await EwtPayee.query().findOne({ uuid: req.params.payee_uuid }).where('is_deleted', false);
        if (!payee) return fail(res, 404, 'Payee not found.');

        const rows = await EwtPayment.query()
            .where({ payee_id: payee.id, is_deleted: false })
            .orderBy('period_year', 'desc')
            .orderBy('period_quarter', 'desc')
            .orderBy('payment_date', 'desc');

        return ok(res, rows);
    } catch (error) {
        return serverError(res, 'ewtPayment.list', error);
    }
};

const createForPayee = async (req, res) => {
    try {
        const payee = await EwtPayee.query().findOne({ uuid: req.params.payee_uuid }).where('is_deleted', false);
        if (!payee) return fail(res, 404, 'Payee not found.');

        const {
            atc_code, income_payment_amount, tax_withheld_amount,
            payment_date, period_year, period_quarter, reference_no, description,
        } = req.body;

        const atc = atcByCode(atc_code);
        if (!atc) return fail(res, 400, 'atc_code is not a recognized ATC code.');
        if (!isValidNumber(income_payment_amount) || Number(income_payment_amount) <= 0) {
            return fail(res, 400, 'income_payment_amount must be a positive number.');
        }
        if (!isValidNumber(tax_withheld_amount) || Number(tax_withheld_amount) < 0) {
            return fail(res, 400, 'tax_withheld_amount must be a non-negative number.');
        }
        if (!isValidDate(payment_date)) return fail(res, 400, 'payment_date is required (YYYY-MM-DD).');
        if (!Number.isInteger(Number(period_year)) || Number(period_year) < 2000 || Number(period_year) > 2100) {
            return fail(res, 400, 'period_year is out of range.');
        }
        if (!(Number(period_quarter) >= 1 && Number(period_quarter) <= 4)) {
            return fail(res, 400, 'period_quarter must be 1-4.');
        }

        const row = await EwtPayment.query()
            .insertAndFetch(definedOnly({
                payee_id: payee.id,
                atc_code: atc.code,
                atc_description: atc.description,
                tax_rate: atc.taxRate,
                income_payment_amount: Number(income_payment_amount),
                tax_withheld_amount: Number(tax_withheld_amount),
                payment_date,
                period_year: Number(period_year),
                period_quarter: Number(period_quarter),
                reference_no: trimOrNull(reference_no),
                description: trimOrNull(description),
                created_by: actorId(req),
            }))
            .context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.ewt_payment_created',
            category: 'payroll',
            description: `Recorded EWT payment of ${row.income_payment_amount} (${row.atc_code}) for "${payee.registered_name}"`,
            metadata: { payee_uuid: payee.uuid, payment_uuid: row.uuid },
            req,
        });

        return created(res, row);
    } catch (error) {
        return serverError(res, 'ewtPayment.create', error);
    }
};

const remove = async (req, res) => {
    try {
        const row = await EwtPayment.query().findOne({ uuid: req.params.uuid }).where('is_deleted', false);
        if (!row) return fail(res, 404, 'Payment not found.');

        await EwtPayment.query().patchAndFetchById(row.id, {
            is_deleted: true, updated_by: actorId(req),
        }).context(withActor(req));

        await logActivity({
            employeeId: actorId(req),
            action: 'payroll.ewt_payment_removed',
            category: 'payroll',
            description: `Removed EWT payment (${row.atc_code}, ${row.income_payment_amount})`,
            metadata: { payment_uuid: row.uuid },
            req,
        });

        return ok(res, { uuid: row.uuid }, { message: 'Payment removed.' });
    } catch (error) {
        return serverError(res, 'ewtPayment.remove', error);
    }
};

module.exports = { listForPayee, createForPayee, remove };
