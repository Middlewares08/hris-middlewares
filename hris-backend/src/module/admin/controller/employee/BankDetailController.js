// Admin counterpart of the employee self-service "Bank Details" section.
// Bank / payment info lives on the employee's ACTIVE payroll.employee_compensations
// row (there is no separate bank table). This controller lists it per employee and
// patches the active row — it never creates a compensation record (pay rate etc.
// stay owned by the Employee Compensation screen).
const Employee = require('../../../../database/models/employee/Employee');
const EmployeeCompensation = require('../../../../database/models/payroll/EmployeeCompensation');
const { logActivity } = require('../../../../utils/activityLogger');

// crypto.js loads its key at require-time; guard so a missing key can never crash a route.
let cryptoUtil = null;
try { cryptoUtil = require('../../../../utils/crypto'); } catch (_) { cryptoUtil = null; }
const encryptSecret = (v) => {
    const s = v === undefined || v === null ? '' : String(v).trim();
    if (!s) return null;
    try { return cryptoUtil ? cryptoUtil.encrypt(s) : s; } catch (_) { return s; }
};
const decryptSecret = (v) => {
    if (!v) return null;
    try { return cryptoUtil ? cryptoUtil.decrypt(String(v)) : String(v); } catch (_) { return null; }
};
const maskAccount = (plain) => {
    if (!plain) return null;
    const s = String(plain);
    return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
};

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check'];

const activeComp = (employeeId, trx) =>
    EmployeeCompensation.query(trx)
        .findOne({ employee_id: employeeId, is_active: true, is_deleted: false });

// 🔍 GET /employee/list/bank-details — one row per employee, with their active
// compensation's bank fields (account number masked, never the ciphertext).
const getEmployeesWithBankDetails = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let query = Employee.query()
            .where('employee.employees.is_deleted', false)
            .withGraphFetched('[credentials, position.[department]]');

        if (search) {
            query = query.where((b) => {
                b.where('first_name', 'ilike', `%${search}%`).orWhere('last_name', 'ilike', `%${search}%`);
            });
        }

        const result = await query
            .orderBy('last_name', 'asc')
            .range(offset, offset + parseInt(limit, 10) - 1);

        const ids = result.results.map((e) => e.id);
        const comps = ids.length
            ? await EmployeeCompensation.query()
                .whereIn('employee_id', ids)
                .where({ is_active: true, is_deleted: false })
            : [];
        const byEmployee = new Map(comps.map((c) => [String(c.employee_id), c]));

        const data = result.results.map((e) => {
            const comp = byEmployee.get(String(e.id));
            const plain = comp ? decryptSecret(comp.bank_account_number) : null;
            return {
                employee_id: e.id,
                employee: {
                    id: e.id,
                    first_name: e.first_name,
                    last_name: e.last_name,
                    employee_id: e.employee_id,
                    profile_url: e.profile_url,
                    credentials: e.credentials,
                    position: e.position,
                },
                has_pay_profile: !!comp,
                compensation_uuid: comp?.uuid || null,
                payment_method: comp?.payment_method || null,
                bank_name: comp?.bank_name || null,
                bank_account_name: comp?.bank_account_name || null,
                bank_account_last4: maskAccount(plain),
                effective_date: comp?.effective_date || null,
            };
        });

        return res.status(200).json({
            success: true,
            data,
            totalRecords: result.total,
            currentPage: parseInt(page, 10),
            recordsPerPage: parseInt(limit, 10),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 💾 POST /employee/list/bank-details — patch bank fields on the active comp row.
// Body: { employeeId, bank_name?, bank_account_name?, bank_account_number?, payment_method? }
// A blank/omitted bank_account_number keeps the stored one.
const upsertBankDetails = async (req, res) => {
    try {
        const id = Number(req.body.employeeId);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'A valid employeeId is required.' });
        }

        const { bank_name, bank_account_name, bank_account_number, payment_method } = req.body;

        if (
            payment_method !== undefined && payment_method !== null && payment_method !== '' &&
            !PAYMENT_METHODS.includes(payment_method)
        ) {
            return res.status(400).json({
                success: false,
                message: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`,
            });
        }

        const comp = await activeComp(id);
        if (!comp) {
            return res.status(409).json({
                success: false,
                message: 'This employee has no active compensation record. Add one under Employee Compensation first.',
            });
        }

        const patch = { updated_by: Number(req.user?.id) || null };
        if (bank_name !== undefined) patch.bank_name = bank_name ? String(bank_name).trim() : null;
        if (bank_account_name !== undefined) patch.bank_account_name = bank_account_name ? String(bank_account_name).trim() : null;
        if (payment_method !== undefined) patch.payment_method = payment_method || 'bank_transfer';
        if (bank_account_number !== undefined && String(bank_account_number).trim() !== '') {
            patch.bank_account_number = encryptSecret(bank_account_number);
        }

        await EmployeeCompensation.query().patchAndFetchById(comp.id, patch).context({ user: req.user });

        await logActivity({
            employeeId: id,
            action: 'payroll.bank_details_updated',
            category: 'payroll',
            description: 'Bank / payment details updated',
            metadata: { compensation_uuid: comp.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Bank details updated.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getEmployeesWithBankDetails, upsertBankDetails };
