/**
 * Employer profile — the registered-employer identity every PH government filing
 * artifact needs (BIR 2316 / Alphalist, SSS R3, PhilHealth RF1, Pag-IBIG MCRF).
 * None of this existed before; payslip PDFs read it from COMPANY_* env vars.
 *
 * Single row, id = 1 (upsert-only via the controller). Employer-level identifiers
 * are stored in plain text — they appear on documents the company itself files.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS payroll');

    await knex.schema.withSchema('payroll').createTable('employer_profile', (table) => {
        table.integer('id').primary().defaultTo(1);

        // --- Identity ---
        table.string('legal_name', 200).nullable();
        table.string('trade_name', 200).nullable();
        table.string('tin', 15).nullable();          // 9 digits, no dashes
        table.string('tin_branch', 5).nullable().defaultTo('0000');
        table.string('rdo_code', 6).nullable();
        table.string('business_category', 30).notNullable().defaultTo('private');

        // --- Registered address ---
        table.string('address_line1', 200).nullable();
        table.string('address_line2', 200).nullable();
        table.string('city', 120).nullable();
        table.string('province', 120).nullable();
        table.string('zip_code', 10).nullable();

        // --- Agency employer numbers ---
        table.string('sss_employer_no', 20).nullable();
        table.string('philhealth_pen', 20).nullable();      // PhilHealth Employer Number
        table.string('pagibig_employer_id', 20).nullable();

        // --- Authorized signatory (BIR 2316 / 1604-C) ---
        table.string('signatory_name', 150).nullable();
        table.string('signatory_position', 120).nullable();
        table.string('signatory_tin', 15).nullable();

        // --- Contact ---
        table.string('contact_person', 150).nullable();
        table.string('contact_email', 150).nullable();
        table.string('contact_phone', 40).nullable();

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);
    });

    await knex('payroll.employer_profile').insert({
        id: 1,
        legal_name: process.env.COMPANY_NAME || null,
        address_line1: process.env.COMPANY_ADDRESS || null,
        business_category: 'private',
        tin_branch: '0000',
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('payroll').dropTableIfExists('employer_profile');
};
