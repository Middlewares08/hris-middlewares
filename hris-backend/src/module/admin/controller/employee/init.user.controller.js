// src/employee/init.controller.js
const connection = require('../../../../database/connection');
const Employee = require('../../../../database/models/employee/Employee');

const initializeFirstUser = async (req, res) => {
    // 💡 Keep the transaction exactly as is
    const trx = await connection.transaction();

    try {
        // 1. 💡 FIX: Add .bindKnex(connection) right before .query(trx)
        const userCount = await Employee.bindKnex(connection).query(trx).count('id as count').first();
        if (parseInt(userCount.count) > 0) {
            await trx.rollback();
            return res.status(400).json({ message: 'System has already been initialized.' });
        }

        // 2. 💡 FIX: Add .bindKnex(connection) to the main insert query
        const rootAdmin = await Employee.bindKnex(connection).query(trx).insert({
            first_name: 'System',
            last_name: 'Administrator',
            preferred_name: 'Admin',
            is_active: true
        });

        // 3. Insert Supporting Tables (Related queries automatically inherit the parent's connection context!)
        await rootAdmin.$relatedQuery('contact', trx).insert({
            personal_email: 'admin@hris.local',
            personal_phone: '+630000000000',
            emergency_contact_name: 'System Fallback',
            emergency_contact_relationship: 'Other',
            emergency_contact_phone: '+630000000000'
        });

        await rootAdmin.$relatedQuery('demographics', trx).insert({
            date_of_birth: '2026-01-01',
            gender: 'Prefer not to say',
            nationality: 'System'
        });

        // 4. Insert the Credentials
        await rootAdmin.$relatedQuery('credentials', trx).insert({
            email: 'admin@hris.local'
        });

        await trx.commit();

        return res.status(201).json({
            message: 'System successfully initialized!',
            default_email: 'admin@hris.local',
            note: 'Check your backend server terminal logs to copy the auto-generated temporary password.'
        });

    } catch (error) {
        await trx.rollback();
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { initializeFirstUser };