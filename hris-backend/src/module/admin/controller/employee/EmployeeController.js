const Employee = require('../../../../database/models/employee/Employee'); // Replace with your actual model path
const crypto = require('crypto');

/**
 * 📋 Get All Employees (Supports Server-side Pagination & Searching)
 */
const getEmployees = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let query = Employee.query()
            .where('employee.employees.is_deleted', false)
            .withGraphFetched('[position.[department], credentials]');

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
            .withGraphFetched('[department, position]');

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
    try {
        const result = await Employee.transaction(async (trx) => {
            return await Employee.query(trx)
                .insert({
                    first_name: req.body.firstname,
                    middle_name: req.body.middlename,
                    last_name: req.body.lastname,
                    profile_url: '', // req.body.uploaded_profile,
                    is_deleted: false,
                })
                .context({
                    graphData: {
                        contact: { 
                            phone_number: req.body.phone, 
                            emergency_contact: req.body.emergency_contact, 
                            emergency_contact_name: req.body.emergency_contact, 
                            personal_email: req.body.personal_email, 
                            personal_phone: req.body.phone_number },
                        demographics: { 
                            gender: req.body.gender, 
                            birth_date: req.body.birth_date, 
                            nationality: req.body.nationality,
                            religion: req.body.religion,
                        },
                        addresses:{ 
                            city: req.body.city, 
                            state_province: req.body.province, 
                            postal_code: req.body.postal, 
                            region: req.body.region, 
                            barangay: req.body.barangay
                        },
                        credentials: { 
                            email: req.body.email, 
                            password: req.body.password
                        },
                        governmentDetails: {
                            is_pagibig_exempt: req.body.is_pagibig_exempt, 
                            is_sss_exempt: req.body.is_sss_exempt, 
                            is_philhealth_exempt: req.body.is_philhealth_exempt, 
                            tin_number: req.body.tin,
                            sss_number: req.body.sss,
                            philhealth_number: req.body.philhealth,
                            pagibig_number: req.body.pagibig
                        },
                        position: { id: req.body.position }
                    }
                });
        });

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
            email, 
            phone, 
            department_id, 
            position_id,
            rate_type, 
            rate 
        } = req.body;

        const updateData = {
            updated_by: req.user?.id ? parseInt(req.user.id, 10) : null
        };

        if (first_name !== undefined) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;
        if (phone !== undefined) updateData.phone = phone;
        if (department_id !== undefined) updateData.department_id = department_id;
        if (position_id !== undefined) updateData.position_id = position_id;
        
        if (rate_type !== undefined) {
            if (rate_type && !['hr', 'day'].includes(rate_type)) {
                return res.status(400).json({ success: false, message: 'Invalid rate type specified.' });
            }
            updateData.rate_type = rate_type;
        }

        if (rate !== undefined) {
            updateData.rate = rate ? parseFloat(rate) : null;
        }

        if (email) {
            // Ensure newly requested email does not conflict with another existing active profile
            const emailConflict = await Employee.query()
                .findOne({ email, is_deleted: false })
                .whereNot({ uuid });
            if (emailConflict) {
                return res.status(400).json({ success: false, message: 'Email already mapped to another profile.' });
            }
            updateData.email = email;
        }

        const updatedRows = await Employee.query()
            .where({ uuid, is_deleted: false })
            .patch(updateData);

        if (updatedRows === 0) {
            return res.status(404).json({ success: false, message: 'Employee profile not found or unmodified.' });
        }

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