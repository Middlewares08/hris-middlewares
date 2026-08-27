/**
 * Payroll module — full schema.
 *
 * Everything lives in the isolated `payroll` logical schema. Tables are normalized:
 *   - pay_components ............... master catalog of earning / deduction / employer-contribution types
 *   - statutory_tables ............ effective-dated SSS / PhilHealth / Pag-IBIG / withholding-tax brackets
 *   - employee_compensations ..... effective-dated base pay + bank + tax profile (1 active per employee)
 *   - employee_component_assignments  BRIDGE employee <-> pay_component (recurring items + loan balances)
 *   - pay_periods ................. payroll cutoff calendar
 *   - payroll_runs ............... one processing run for a period (+ snapshot totals & approval trail)
 *   - payslips ................... per-employee result inside a run
 *   - payslip_lines ............. normalized line items for a payslip, each tied to a pay_component
 *   - payslip_adjustments ...... one-off per-run per-employee earnings / deductions
 *
 * Audit trail on every table: created_by / updated_by (FK employee.employees, SET NULL) + created_at / updated_at.
 * Soft delete on every table:  is_deleted boolean (default false).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS payroll');
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Shared audit + soft-delete columns. Called at the END of every createTable callback.
    const auditColumns = (table) => {
        table.boolean('is_deleted').notNullable().defaultTo(false);
        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamps(true, true); // created_at, updated_at (default now())
    };

    /* ------------------------------------------------------------------ *
     * 1. pay_components — master catalog
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('pay_components', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.string('code', 60).notNullable().unique();       // BASIC, OT_REG, ALLOW_MEAL, SSS_EE ...
        table.string('name', 150).notNullable();
        table.string('description', 500).nullable();

        table.enum('component_type', ['earning', 'deduction', 'employer_contribution']).notNullable();
        table.enum('calculation_type', [
            'fixed',                 // flat default_amount
            'hourly_rate',           // default_rate * hours
            'daily_rate',            // default_rate * days
            'percentage_of_basic',   // default_rate (0..1) * basic pay
            'percentage_of_gross',   // default_rate (0..1) * gross pay
            'formula',               // engine-specific handler keyed by code
            'statutory',             // resolved from payroll.statutory_tables
            'manual'                 // always supplied per payslip / assignment
        ]).notNullable().defaultTo('manual');

        table.decimal('default_amount', 14, 2).nullable();
        table.decimal('default_rate', 12, 6).nullable();

        table.boolean('is_taxable').notNullable().defaultTo(false);
        table.boolean('is_statutory').notNullable().defaultTo(false);
        table.boolean('affects_thirteenth_month').notNullable().defaultTo(false);
        table.boolean('is_system').notNullable().defaultTo(false);   // seeded defaults — protected from delete
        table.boolean('is_active').notNullable().defaultTo(true);

        table.integer('display_order').notNullable().defaultTo(0);
        table.string('gl_account', 60).nullable();
        table.jsonb('metadata').nullable();

        auditColumns(table);

        table.index(['component_type', 'is_active']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 2. statutory_tables — effective-dated government contribution config
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('statutory_tables', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.enum('type', ['sss', 'philhealth', 'pagibig', 'withholding_tax']).notNullable();
        table.string('label', 150).notNullable();

        table.date('effective_from').notNullable();
        table.date('effective_to').nullable();

        table.enum('frequency', ['monthly', 'semi_monthly', 'annual']).notNullable().defaultTo('monthly');

        // brackets: array of rows. Shape depends on `type` — see payrollCalculator.js for the contract.
        //   contributions -> [{ min, max, employee, employer, ec }] OR config.mode === 'percentage'
        //   withholding_tax -> [{ min, max, base_tax, rate, excess_over }]
        table.jsonb('brackets').notNullable().defaultTo(JSON.stringify([]));
        table.jsonb('config').nullable(); // caps, floors, fixed shares, mode flags

        table.boolean('is_active').notNullable().defaultTo(true);

        auditColumns(table);

        table.index(['type', 'is_active']);
        table.index(['type', 'effective_from']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 3. employee_compensations — effective-dated base pay profile
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('employee_compensations', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.decimal('pay_rate', 14, 2).notNullable();
        table.enum('rate_type', ['monthly', 'semi_monthly', 'daily', 'hourly']).notNullable().defaultTo('monthly');

        // Normalized monthly basic — the figure statutory contributions are computed against.
        table.decimal('monthly_equivalent', 14, 2).notNullable();

        table.decimal('working_days_per_month', 5, 2).notNullable().defaultTo(22);
        table.decimal('working_hours_per_day', 5, 2).notNullable().defaultTo(8);

        table.enum('pay_frequency', ['monthly', 'semi_monthly', 'weekly', 'bi_weekly'])
            .notNullable().defaultTo('semi_monthly');

        table.string('currency', 3).notNullable().defaultTo('PHP');
        table.string('tax_status', 10).nullable();                    // S, ME, S1, ME2 ...
        table.boolean('is_minimum_wage_earner').notNullable().defaultTo(false); // MWE — tax exempt
        table.boolean('is_tax_exempt').notNullable().defaultTo(false);

        table.enum('payment_method', ['bank_transfer', 'cash', 'check']).notNullable().defaultTo('bank_transfer');
        table.string('bank_name', 150).nullable();
        table.string('bank_account_name', 150).nullable();
        table.string('bank_account_number', 255).nullable(); // stored encrypted (see crypto.js)

        table.date('effective_date').notNullable();
        table.date('end_date').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.string('remarks', 500).nullable();

        auditColumns(table);

        table.index(['employee_id', 'is_active']);
        table.index(['effective_date']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 4. employee_component_assignments — BRIDGE employee <-> pay_component
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('employee_component_assignments', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');
        table.bigInteger('component_id').unsigned().notNullable()
            .references('id').inTable('payroll.pay_components').onDelete('RESTRICT');

        table.decimal('amount', 14, 2).nullable();  // per-period fixed amount
        table.decimal('rate', 12, 6).nullable();    // per-period rate override (0..1 for %)

        // Loan / cash-advance amortization tracking (nullable for plain allowances)
        table.decimal('principal_amount', 14, 2).nullable();
        table.decimal('outstanding_balance', 14, 2).nullable();
        table.decimal('installment_amount', 14, 2).nullable();
        table.string('reference_no', 100).nullable();

        table.date('start_date').notNullable();
        table.date('end_date').nullable();
        table.enum('status', ['active', 'paused', 'completed', 'cancelled']).notNullable().defaultTo('active');
        table.string('notes', 500).nullable();
        table.jsonb('metadata').nullable();

        auditColumns(table);

        table.unique(['employee_id', 'component_id', 'start_date']);
        table.index(['employee_id', 'status']);
        table.index(['component_id']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 5. pay_periods — cutoff calendar
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('pay_periods', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.string('name', 150).notNullable();
        table.date('period_start').notNullable();
        table.date('period_end').notNullable();
        table.date('pay_date').notNullable();

        table.enum('frequency', ['monthly', 'semi_monthly', 'weekly', 'bi_weekly'])
            .notNullable().defaultTo('semi_monthly');
        table.enum('sequence', ['first_cutoff', 'second_cutoff', 'monthly', 'special'])
            .notNullable().defaultTo('monthly');

        // open   -> runs may be created / recalculated
        // locked -> a run is approved; no new draft runs
        // closed -> period archived
        table.enum('status', ['open', 'locked', 'closed']).notNullable().defaultTo('open');
        table.string('remarks', 500).nullable();

        auditColumns(table);

        table.unique(['period_start', 'period_end', 'frequency', 'sequence']);
        table.index(['status']);
        table.index(['pay_date']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 6. payroll_runs — a processing run for a period
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('payroll_runs', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('pay_period_id').unsigned().notNullable()
            .references('id').inTable('payroll.pay_periods').onDelete('RESTRICT');

        table.enum('run_type', ['regular', 'off_cycle', 'thirteenth_month', 'final_pay', 'adjustment'])
            .notNullable().defaultTo('regular');
        table.integer('run_number').notNullable().defaultTo(1);

        table.enum('status', ['draft', 'calculating', 'calculated', 'approved', 'paid', 'cancelled'])
            .notNullable().defaultTo('draft');
        table.string('notes', 500).nullable();

        // Snapshot totals refreshed on every calculation
        table.integer('employee_count').notNullable().defaultTo(0);
        table.decimal('total_gross', 16, 2).notNullable().defaultTo(0);
        table.decimal('total_taxable', 16, 2).notNullable().defaultTo(0);
        table.decimal('total_deductions', 16, 2).notNullable().defaultTo(0);
        table.decimal('total_net', 16, 2).notNullable().defaultTo(0);
        table.decimal('total_employer_cost', 16, 2).notNullable().defaultTo(0);
        table.timestamp('calculated_at', { useTz: true }).nullable();

        table.bigInteger('approved_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamp('approved_at', { useTz: true }).nullable();
        table.bigInteger('paid_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        table.timestamp('paid_at', { useTz: true }).nullable();

        auditColumns(table);

        table.unique(['pay_period_id', 'run_type', 'run_number']);
        table.index(['status']);
        table.index(['pay_period_id']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 7. payslips — per-employee result inside a run
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('payslips', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('payroll_run_id').unsigned().notNullable()
            .references('id').inTable('payroll.payroll_runs').onDelete('CASCADE');
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('RESTRICT');
        table.bigInteger('compensation_id').unsigned().nullable()
            .references('id').inTable('payroll.employee_compensations').onDelete('SET NULL');

        // Compensation snapshot
        table.decimal('pay_rate', 14, 2).notNullable().defaultTo(0);
        table.string('rate_type', 20).nullable();
        table.decimal('monthly_equivalent', 14, 2).notNullable().defaultTo(0);

        // Attendance-derived snapshot for the covered period
        table.decimal('days_worked', 6, 2).notNullable().defaultTo(0);
        table.decimal('hours_worked', 8, 2).notNullable().defaultTo(0);
        table.decimal('days_absent', 6, 2).notNullable().defaultTo(0);
        table.integer('late_minutes').notNullable().defaultTo(0);
        table.integer('undertime_minutes').notNullable().defaultTo(0);
        table.decimal('overtime_hours', 8, 2).notNullable().defaultTo(0);

        // Money buckets
        table.decimal('basic_pay', 14, 2).notNullable().defaultTo(0);
        table.decimal('total_earnings', 14, 2).notNullable().defaultTo(0);
        table.decimal('gross_pay', 14, 2).notNullable().defaultTo(0);
        table.decimal('taxable_income', 14, 2).notNullable().defaultTo(0);
        table.decimal('non_taxable_income', 14, 2).notNullable().defaultTo(0);
        table.decimal('total_deductions', 14, 2).notNullable().defaultTo(0);
        table.decimal('total_employer_contributions', 14, 2).notNullable().defaultTo(0);
        table.decimal('withholding_tax', 14, 2).notNullable().defaultTo(0);
        table.decimal('net_pay', 14, 2).notNullable().defaultTo(0);

        table.enum('status', ['draft', 'calculated', 'on_hold', 'released', 'cancelled'])
            .notNullable().defaultTo('draft');
        table.enum('payment_method', ['bank_transfer', 'cash', 'check']).notNullable().defaultTo('bank_transfer');
        table.string('payment_reference', 150).nullable();
        table.timestamp('released_at', { useTz: true }).nullable();
        table.string('notes', 500).nullable();

        auditColumns(table);

        table.unique(['payroll_run_id', 'employee_id']);
        table.index(['employee_id', 'status']);
        table.index(['payroll_run_id']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 8. payslip_lines — normalized line items
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('payslip_lines', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('payslip_id').unsigned().notNullable()
            .references('id').inTable('payroll.payslips').onDelete('CASCADE');
        table.bigInteger('component_id').unsigned().nullable()
            .references('id').inTable('payroll.pay_components').onDelete('SET NULL');
        // Which recurring assignment produced this line (loan amortization traceability)
        table.bigInteger('assignment_id').unsigned().nullable()
            .references('id').inTable('payroll.employee_component_assignments').onDelete('SET NULL');

        table.enum('line_type', ['earning', 'deduction', 'employer_contribution']).notNullable();
        table.enum('source', ['basic', 'attendance', 'recurring', 'adjustment', 'statutory', 'manual', 'system'])
            .notNullable().defaultTo('system');

        table.string('code', 60).nullable();     // component code snapshot
        table.string('label', 150).notNullable(); // component name snapshot
        table.decimal('quantity', 14, 4).notNullable().defaultTo(1);
        table.decimal('rate', 16, 4).notNullable().defaultTo(0);
        table.decimal('amount', 14, 2).notNullable().defaultTo(0);

        table.boolean('is_taxable').notNullable().defaultTo(false);
        table.boolean('is_statutory').notNullable().defaultTo(false);
        table.integer('sequence').notNullable().defaultTo(0);
        table.string('remarks', 500).nullable();
        table.jsonb('metadata').nullable();

        auditColumns(table);

        table.index(['payslip_id', 'line_type']);
        table.index(['component_id']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * 9. payslip_adjustments — one-off per-run per-employee items
     * ------------------------------------------------------------------ */
    await knex.schema.withSchema('payroll').createTable('payslip_adjustments', (table) => {
        table.bigIncrements('id').primary();
        table.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        table.bigInteger('payroll_run_id').unsigned().notNullable()
            .references('id').inTable('payroll.payroll_runs').onDelete('CASCADE');
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('RESTRICT');
        table.bigInteger('component_id').unsigned().nullable()
            .references('id').inTable('payroll.pay_components').onDelete('SET NULL');

        table.enum('adjustment_type', ['earning', 'deduction']).notNullable();
        table.string('label', 150).notNullable();
        table.decimal('amount', 14, 2).notNullable();
        table.boolean('is_taxable').notNullable().defaultTo(false);
        table.string('reason', 500).notNullable();

        table.enum('status', ['pending', 'applied', 'cancelled']).notNullable().defaultTo('pending');
        table.bigInteger('applied_payslip_id').unsigned().nullable()
            .references('id').inTable('payroll.payslips').onDelete('SET NULL');

        auditColumns(table);

        table.index(['payroll_run_id', 'employee_id']);
        table.index(['status']);
        table.index(['is_deleted']);
    });

    /* ------------------------------------------------------------------ *
     * Baseline data — seeded here (not in /seeders) so it is guaranteed to
     * land exactly once and never trips the fragile seeder chain.
     * Statutory figures reflect commonly published PH rates; VERIFY against
     * the latest official circulars before your first live run.
     * ------------------------------------------------------------------ */
    await knex('payroll.pay_components').insert([
        { code: 'BASIC', name: 'Basic Pay', component_type: 'earning', calculation_type: 'formula', is_taxable: true, affects_thirteenth_month: true, is_system: true, display_order: 10 },
        { code: 'OT_REG', name: 'Overtime Pay', component_type: 'earning', calculation_type: 'hourly_rate', default_rate: 1.25, is_taxable: true, is_system: true, display_order: 20 },
        { code: 'NIGHT_DIFF', name: 'Night Differential', component_type: 'earning', calculation_type: 'hourly_rate', default_rate: 0.10, is_taxable: true, is_system: true, display_order: 30 },
        { code: 'HOLIDAY_PAY', name: 'Holiday Pay', component_type: 'earning', calculation_type: 'manual', is_taxable: true, is_system: true, display_order: 40 },
        { code: 'ALLOW_DEMINIMIS', name: 'De Minimis Allowance', component_type: 'earning', calculation_type: 'fixed', is_taxable: false, is_system: true, display_order: 50 },
        { code: 'ALLOW_TAXABLE', name: 'Taxable Allowance', component_type: 'earning', calculation_type: 'fixed', is_taxable: true, is_system: true, display_order: 60 },
        { code: 'THIRTEENTH_MONTH', name: '13th Month Pay', component_type: 'earning', calculation_type: 'formula', is_taxable: false, is_system: true, display_order: 70 },
        { code: 'TARDINESS', name: 'Tardiness / Undertime', component_type: 'deduction', calculation_type: 'formula', is_system: true, display_order: 100 },
        { code: 'ABSENCE', name: 'Absences', component_type: 'deduction', calculation_type: 'formula', is_system: true, display_order: 110 },
        { code: 'SSS_EE', name: 'SSS Contribution (EE)', component_type: 'deduction', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 200, metadata: JSON.stringify({ statutory_type: 'sss' }) },
        { code: 'PHIC_EE', name: 'PhilHealth Contribution (EE)', component_type: 'deduction', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 210, metadata: JSON.stringify({ statutory_type: 'philhealth' }) },
        { code: 'HDMF_EE', name: 'Pag-IBIG Contribution (EE)', component_type: 'deduction', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 220, metadata: JSON.stringify({ statutory_type: 'pagibig' }) },
        { code: 'WTAX', name: 'Withholding Tax', component_type: 'deduction', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 230, metadata: JSON.stringify({ statutory_type: 'withholding_tax' }) },
        { code: 'SSS_LOAN', name: 'SSS Salary Loan', component_type: 'deduction', calculation_type: 'manual', is_system: true, display_order: 300 },
        { code: 'HDMF_LOAN', name: 'Pag-IBIG Loan', component_type: 'deduction', calculation_type: 'manual', is_system: true, display_order: 310 },
        { code: 'CASH_ADVANCE', name: 'Cash Advance', component_type: 'deduction', calculation_type: 'manual', is_system: true, display_order: 320 },
        { code: 'SSS_ER', name: 'SSS Contribution (ER)', component_type: 'employer_contribution', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 400, metadata: JSON.stringify({ statutory_type: 'sss' }) },
        { code: 'PHIC_ER', name: 'PhilHealth Contribution (ER)', component_type: 'employer_contribution', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 410, metadata: JSON.stringify({ statutory_type: 'philhealth' }) },
        { code: 'HDMF_ER', name: 'Pag-IBIG Contribution (ER)', component_type: 'employer_contribution', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 420, metadata: JSON.stringify({ statutory_type: 'pagibig' }) },
        { code: 'SSS_EC', name: 'SSS EC (ER)', component_type: 'employer_contribution', calculation_type: 'statutory', is_statutory: true, is_system: true, display_order: 430, metadata: JSON.stringify({ statutory_type: 'sss' }) }
    ]).onConflict('code').ignore();

    await knex('payroll.statutory_tables').insert([
        {
            type: 'sss',
            label: 'SSS Contribution Schedule (2025)',
            effective_from: '2025-01-01',
            frequency: 'monthly',
            config: JSON.stringify({ mode: 'percentage', employee_rate: 0.05, employer_rate: 0.10, ec_amount: 10, msc_floor: 5000, msc_ceiling: 35000, round_msc_to: 500 }),
            brackets: JSON.stringify([])
        },
        {
            type: 'philhealth',
            label: 'PhilHealth Premium Schedule (2025)',
            effective_from: '2025-01-01',
            frequency: 'monthly',
            config: JSON.stringify({ mode: 'percentage', total_rate: 0.05, employee_share: 0.5, salary_floor: 10000, salary_ceiling: 100000 }),
            brackets: JSON.stringify([])
        },
        {
            type: 'pagibig',
            label: 'Pag-IBIG Contribution Schedule (2024+)',
            effective_from: '2024-02-01',
            frequency: 'monthly',
            config: JSON.stringify({ mode: 'bracket_percentage', fund_salary_ceiling: 10000, tiers: [{ up_to: 1500, employee_rate: 0.01, employer_rate: 0.02 }, { up_to: null, employee_rate: 0.02, employer_rate: 0.02 }] }),
            brackets: JSON.stringify([])
        },
        {
            type: 'withholding_tax',
            label: 'BIR Withholding Tax — Monthly (TRAIN, 2023+)',
            effective_from: '2023-01-01',
            frequency: 'monthly',
            config: JSON.stringify({ mode: 'annualized_brackets' }),
            brackets: JSON.stringify([
                { min: 0, max: 20833, base_tax: 0, rate: 0, excess_over: 0 },
                { min: 20833, max: 33332, base_tax: 0, rate: 0.15, excess_over: 20833 },
                { min: 33333, max: 66666, base_tax: 1875, rate: 0.20, excess_over: 33333 },
                { min: 66667, max: 166666, base_tax: 8541.80, rate: 0.25, excess_over: 66667 },
                { min: 166667, max: 666666, base_tax: 33541.80, rate: 0.30, excess_over: 166667 },
                { min: 666667, max: null, base_tax: 183541.80, rate: 0.35, excess_over: 666667 }
            ])
        }
    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // CASCADE clears every table + FK inside the schema in one shot.
    await knex.raw('DROP SCHEMA IF EXISTS payroll CASCADE');
};
