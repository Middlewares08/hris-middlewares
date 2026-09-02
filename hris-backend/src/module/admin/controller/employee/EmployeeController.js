const Employee = require('../../../../database/models/employee/Employee'); // Replace with your actual model path
const EmployeeCompensation = require('../../../../database/models/payroll/EmployeeCompensation');
const crypto = require('crypto');

/**
 * Build the next EMP-<year>-<4-digit seq> identifier. The sequence resets per
 * calendar year. Runs on the supplied transaction so concurrent creates see each
 * other's rows; the unique index on employee_id is the final backstop.
 */
const generateEmployeeId = async (trx, year) => {
    const prefix = `EMP-${year}-`;
    const row = await trx('employee.employees')
        .where('employee_id', 'like', `${prefix}%`)
        .max({ max_seq: trx.raw("CAST(split_part(employee_id, '-', 3) AS INTEGER)") })
        .first();
    const next = (row?.max_seq || 0) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
};

/**
 * 📋 Get All Employees (Supports Server-side Pagination & Searching)
 */
const getEmployees = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let query = Employee.query()
            .where('employee.employees.is_deleted', false)
            .withGraphFetched('[position.[department], credentials, compensation, contact, demographics, roles]');

        if (search) {
            query = query.where((builder) => {
                builder.where('employee.employees.first_name', 'ilike', `%${search}%`)
                    .orWhere('employee.employees.last_name', 'ilike', `%${search}%`)
                    // 🎯 Safely search the related credentials table for the email
                    .orWhereExists(
                        Employee.relatedQuery('credentials')
                            .where('email', 'ilike', `%${search}%`)
                    );
            });
        }

        // Fetch Paginated Dataset
        const result = await query
            .orderBy('employee.employees.last_name', 'asc')
            .range(offset, offset + parseInt(limit, 10) - 1);

        return res.status(200).json({
            success: true,
            data: result.results,
            totalRecords: result.total,
            currentPage: parseInt(page, 10),
            recordsPerPage: parseInt(limit, 10)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🔍 Get Single Employee by UUID
 */
const getEmployeeByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;
        const employee = await Employee.query()
            .findOne({ uuid, is_deleted: false })
            .withGraphFetched('[position.[department], credentials, compensation, contact, demographics, roles]');

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee profile not found.' });
        }

        return res.status(200).json({ success: true, data: employee });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ➕ Create New Employee Record
 */
const createEmployee = async (req, res) => {
    const b = req.body;
    const actorId = req.user?.id ? parseInt(req.user.id, 10) : null;

    // Hard requirements — NOT NULL columns with no sensible default.
    const missing = [];
    if (!b.firstname) missing.push('firstname');
    if (!b.lastname) missing.push('lastname');
    if (!b.email) missing.push('email');
    if (!b.personal_email) missing.push('personal_email');
    if (!b.phone_number) missing.push('phone_number');
    if (!b.birth_date) missing.push('birth_date');
    if (missing.length) {
        return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    }

    const graphData = {
        contact: {
            personal_email: b.personal_email,
            personal_phone: b.phone_number,
            emergency_contact_name: b.emergency_contact_name || null,
            emergency_contact_relationship: b.emergency_contact_relationship || null,
            emergency_contact_phone: b.emergency_contact_phone || null,
        },
        demographics: {
            date_of_birth: String(b.birth_date).substring(0, 10),
            gender: b.gender || 'unspecified',
            nationality: b.nationality || 'unspecified',
            religion: b.religion || null,
        },
        addresses: {
            street_address: b.street_address || null,
            city: b.city || null,
            state_province: b.province || null,
            postal_code: b.postal || null,
            region: b.region || null,
            barangay: b.barangay || null,
        },
        // password_hash carries the plaintext; the Credential model hashes it, and
        // auto-generates a temporary one when it is absent.
        credentials: b.password
            ? { email: b.email, password_hash: b.password }
            : { email: b.email },
        governmentDetails: {
            tin_number: b.tin_number || null,
            sss_number: b.sss_number || null,
            philhealth_number: b.philhealth_number || null,
            pagibig_number: b.pagibig_number || null,
            is_sss_exempt: !!b.is_sss_exempt,
            is_philhealth_exempt: !!b.is_philhealth_exempt,
            is_pagibig_exempt: !!b.is_pagibig_exempt,
        },
    };
    if (b.position) graphData.position = { id: Number(b.position) };

    // Retry once if the generated employee_id collides with a concurrent insert.
    const runCreate = async () => Employee.transaction(async (trx) => {
        const hireDate = b.date_hired
            ? String(b.date_hired).substring(0, 10)
            : new Date().toISOString().substring(0, 10);
        const hireYear = new Date(hireDate).getFullYear() || new Date().getFullYear();
        const employeeId = await generateEmployeeId(trx, hireYear);

        const employee = await Employee.query(trx)
            .insert({
                employee_id: employeeId,
                first_name: b.firstname,
                middle_name: b.middlename || null,
                last_name: b.lastname,
                date_hired: hireDate,
                employment_type: b.employment_type || null,
                profile_url: '', // base64 upload handled separately; column is capped at 2048
                is_deleted: false,
            })
            .context({ graphData, user: req.user });

        // Every employee gets the default role (self-service PWA access).
        const defaultRole = await trx('role_permission.roles').where({ is_default: true }).first();
        if (defaultRole) {
            await trx('role_permission.employee_roles')
                .insert({ employee_id: employee.id, role_id: defaultRole.id, created_by: actorId, updated_by: actorId })
                .onConflict(['employee_id', 'role_id'])
                .ignore();
        }

        // Seed the employee's active pay profile in payroll.employee_compensations.
        if (b.pay_rate !== undefined && b.pay_rate !== null && b.pay_rate !== '') {
            await EmployeeCompensation.setActive(trx, {
                employeeId: employee.id,
                pay_rate: b.pay_rate,
                rate_type: b.rate_type || 'monthly',
                effective_date: hireDate,
                actorId,
            });
        }

        return employee;
    });

    try {
        let result;
        try {
            result = await runCreate();
        } catch (error) {
            // Unique violation on employee_id — regenerate and try once more.
            if (error?.nativeError?.code === '23505' || /employee_id/i.test(error?.message || '')) {
                result = await runCreate();
            } else {
                throw error;
            }
        }

        return res.status(201).json({
            success: true,
            message: "Employee registered successfully!",
            data: result
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 📝 Update Employee details
 */
const updateEmployee = async (req, res) => {
    try {
        const { uuid } = req.params;
        const {
            first_name,
            last_name,
            middle_name,
            position_id,
            rate_type,
            pay_rate,
            effective_date,
            date_hired,
            employment_type,
            role_ids
        } = req.body;
        const actorId = req.user?.id ? parseInt(req.user.id, 10) : null;

        const employee = await Employee.query().findOne({ uuid, is_deleted: false });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee profile not found.' });
        }

        const updateData = { updated_by: actorId };
        if (first_name !== undefined) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;
        if (middle_name !== undefined) updateData.middle_name = middle_name || null;
        if (date_hired !== undefined) updateData.date_hired = date_hired ? String(date_hired).substring(0, 10) : null;
        if (employment_type !== undefined) updateData.employment_type = employment_type || null;

        await Employee.transaction(async (trx) => {
            await Employee.query(trx).where({ id: employee.id }).patch(updateData).context({ user: req.user });

            // Position lives in the employee.positions pivot (HasOneThrough).
            if (position_id !== undefined && position_id !== null && position_id !== '') {
                await trx('employee.positions').where({ employee_id: employee.id }).del();
                await trx('employee.positions').insert({
                    employee_id: employee.id,
                    position_id: Number(position_id),
                    created_by: actorId,
                });
            }

            // Pay rate lives in payroll.employee_compensations — supersede the active row.
            if (pay_rate !== undefined && pay_rate !== null && pay_rate !== '') {
                await EmployeeCompensation.setActive(trx, {
                    employeeId: employee.id,
                    pay_rate,
                    rate_type: rate_type || 'monthly',
                    effective_date: effective_date || new Date().toISOString().substring(0, 10),
                    actorId,
                });
            }

            // Roles live in the role_permission.employee_roles pivot. When the caller
            // supplies an explicit list, sync it: drop rows no longer selected and
            // insert the newly checked ones. An empty array clears every role.
            if (Array.isArray(role_ids)) {
                const desired = [...new Set(role_ids.map(Number).filter((n) => Number.isInteger(n)))];

                const existing = await trx('role_permission.employee_roles')
                    .where({ employee_id: employee.id })
                    .pluck('role_id');

                const toRemove = existing.filter((id) => !desired.includes(id));
                const toAdd = desired.filter((id) => !existing.includes(id));

                if (toRemove.length) {
                    await trx('role_permission.employee_roles')
                        .where({ employee_id: employee.id })
                        .whereIn('role_id', toRemove)
                        .del();
                }

                for (const roleId of toAdd) {
                    await trx('role_permission.employee_roles')
                        .insert({ employee_id: employee.id, role_id: roleId, created_by: actorId, updated_by: actorId })
                        .onConflict(['employee_id', 'role_id'])
                        .ignore();
                }
            }
        });

        return res.status(200).json({ success: true, message: 'Employee profile updated successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🗑️ Soft Delete Employee Profile
 */
const deleteEmployee = async (req, res) => {
    try {
        const { uuid } = req.params;

        const updatedRows = await Employee.query()
            .where({ uuid, is_deleted: false })
            .patch({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: req.user?.id ? parseInt(req.user.id, 10) : null
            });

        if (updatedRows === 0) {
            return res.status(404).json({ success: false, message: 'Employee record not found.' });
        }

        return res.status(200).json({ success: true, message: 'Employee soft-deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getEmployees,
    getEmployeeByUuid,
    createEmployee,
    updateEmployee,
    deleteEmployee
};