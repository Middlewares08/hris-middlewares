const GovernmentDetails = require('../../../../database/models/employee/GovernmentDetail');
const Employee = require('../../../../database/models/employee/Employee');

// 🔍 GET: Retrieve details for a specific employee
const getEmployeesWithBenefits = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        let query = GovernmentDetails.query()
            .joinRelated('employee.[credentials, position]')
            .where('employee.is_deleted', false)
            .withGraphFetched('employee.[credentials, position.[department]]');

        // Apply optional search filter
        if (search) {
            query = query.where((builder) => {
                builder.where('employee.first_name', 'ilike', `%${search}%`)
                    .orWhere('employee.last_name', 'ilike', `%${search}%`);
            });
        }
        // Fetch Paginated Dataset using .range()
        const result = await query
            .orderBy('employee.last_name', 'asc')
            .range(offset, offset + parseInt(limit, 10) - 1);

        return res.status(200).json({ 
            success: true, 
            data: result.results, // Objection returns the sliced array in .results
            totalRecords: result.total, // Total matching rows in DB
            currentPage: parseInt(page, 10),
            recordsPerPage: parseInt(limit, 10)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 💾 POST/PUT: Upsert government details 
const upsertGovernmentDetails = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const payload = req.body;

        // Upsert logic: find existing record, or insert a new one
        const updatedDetails = await GovernmentDetails.query()
            .upsertGraph({
                employee_id: payload?.employee_id,
                sss_number: payload?.sss_number,
                pagibig_number: payload?.pagibig_number,
                tin_number: payload?.tin_number,
                philhealth_number: payload?.philhealth_number,
                is_philhealth_exempt: payload?.is_philhealth_exempt,
                is_pagibig_exempt: payload?.is_pagibig_exempt,
                is_sss_exempt: payload?.is_sss_exempt,
            }, {
                insertMissing: true // Inserts if employee_id doesn't exist yet in the DB
            });
            
        return res.status(200).json({
            success: true,
            message: 'Government details updated successfully',
            data: updatedDetails
        });
    } catch (error) {
        // Catch PostgreSQL unique constraint violations (e.g. duplicate SSS or TIN)
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'One of the government numbers is already registered.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 🗑️ DELETE: Reset/Remove government details
const deleteGovernmentDetails = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const deletedCount = await GovernmentDetails.query()
            .deleteById(employeeId);

        if (!deletedCount) {
            return res.status(404).json({ success: false, message: 'Details not found' });
        }

        return res.status(200).json({ success: true, message: 'Government details cleared' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getEmployeesWithBenefits,
    upsertGovernmentDetails,
    deleteGovernmentDetails
};