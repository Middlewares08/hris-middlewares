/**
 * Expanded Withholding Tax (EWT) payees + their income payments — feeds BIR Form 2307
 * (Certificate of Creditable Tax Withheld at Source, Expanded).
 *
 * Unlike BIR 2316 (annual compensation certificate for employees, built from
 * `payroll.payslips`), 2307 is issued to non-employee payees (contractors, professionals,
 * talents, suppliers) subject to EWT under an ATC code — a separate concept from Employee
 * records entirely.
 *
 *   - ewt_payees ..... master record for a contractor/professional/talent/supplier
 *   - ewt_payments ... one income payment + tax withheld, tagged to a filing quarter
 *
 * Audit trail + soft delete mirror every other payroll table (see `20260828100000_create_payroll_tables.js`).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS payroll');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    const auditColumns = (table) => {
        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true);
    };

    /* ------------------------------------------------------------------ *
     * 1. ewt_payees — contractor / professional / talent / supplier master
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('ewt_payees', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.enum('payee_type', ['individual', 'non_individual']).notNullable().defaultTo('individual');
        table.string('registered_name', 200).notNullable(); // what prints on the certificate
        table.string('first_name', 150).nullable();
        table.string('middle_name', 150).nullable();
        table.string('last_name', 150).nullable();
        table.string('trade_name', 200).nullable();

        table.string('tin', 15).notNullable();
        table.string('tin_branch', 5).notNullable().defaultTo('0000');

        table.string('address_line1', 200).nullable();
        table.string('address_line2', 200).nullable();
        table.string('city', 120).nullable();
        table.string('province', 120).nullable();
        table.string('zip_code', 10).nullable();

        table.string('default_atc_code', 10).nullable(); // prefill convenience only, not an FK

        table.string('contact_person', 150).nullable();
        table.string('contact_email', 150).nullable();
        table.string('contact_phone', 40).nullable();

        table.boolean('is_active').notNullable().defaultTo(true);
        table.string('remarks', 500).nullable();

        auditColumns(table);
        table.index(['payee_type', 'is_active']);
    });

    /* ------------------------------------------------------------------ *
     * 2. ewt_payments — one income payment + tax withheld, tagged to a quarter
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('ewt_payments', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('payee_id').unsigned().notNullable()
            .references('id').inTable('payroll.ewt_payees').onDelete('RESTRICT');

        table.string('atc_code', 10).notNullable();
        table.string('atc_description', 200).notNullable(); // snapshot — ATC wording can change over time
        table.decimal('tax_rate', 6, 4).notNullable();

        table.decimal('income_payment_amount', 14, 2).notNullable();
        table.decimal('tax_withheld_amount', 14, 2).notNullable();

        table.date('payment_date').notNullable();
        table.integer('period_year').notNullable();
        table.integer('period_quarter').notNullable(); // 1-4, app-validated

        table.string('reference_no', 100).nullable();
        table.string('description', 500).nullable();

        auditColumns(table);
        table.index(['payee_id']);
        table.index(['period_year', 'period_quarter']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.withSchema('payroll').dropTableIfExists('ewt_payments');
    await knex.schema.withSchema('payroll').dropTableIfExists('ewt_payees');
};
