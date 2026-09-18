const Employee = require('../../../../database/models/employee/Employee');

const EDUCATION_LEVELS = ['elementary', 'secondary', 'vocational', 'college', 'graduate'];

// Drops incomplete rows (no school name) and coerces year fields to integers or
// null — mirrors EmployeeController's create-time sanitizer.
const sanitizeEducation = (education) => {
    if (!Array.isArray(education)) return [];
    return education
        .filter((row) => row && String(row.school_name || '').trim())
        .map((row) => ({
            education_level: EDUCATION_LEVELS.includes(row.education_level) ? row.education_level : 'college',
            school_name: String(row.school_name).trim(),
            degree: row.degree ? String(row.degree).trim() : null,
            year_started: row.year_started ? parseInt(row.year_started, 10) || null : null,
            year_graduated: row.year_graduated ? parseInt(row.year_graduated, 10) || null : null,
            honors: row.honors ? String(row.honors).trim() : null,
        }));
};

/**
 * ✏️ Replace an employee's whole educational-background list — the admin
 * post-creation edit counterpart to the employee self-service
 * PATCH /auth/me/education. Whole-list replace, same as that endpoint.
 */
const updateEmployeeEducation = async (req, res) => {
    try {
        const { uuid } = req.params;
        const employee = await Employee.query().findOne({ uuid, is_deleted: false });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee profile not found.' });
        }

        const education = sanitizeEducation(req.body?.education);
        const ctx = { user: req.user };

        await Employee.transaction(async (trx) => {
            await employee.$relatedQuery('educationalBackgrounds', trx).delete();
            if (education.length) {
                await employee.$relatedQuery('educationalBackgrounds', trx).context(ctx).insert(education);
            }
        });

        return res.status(200).json({ success: true, message: 'Educational background updated.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { updateEmployeeEducation };
