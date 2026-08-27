/**
 * Replace the opaque JSONB `brackets` / `config` on payroll.statutory_tables with
 * real, readable columns + a normalized `payroll.statutory_brackets` child table.
 *
 *   statutory_tables  — scalar knobs (rates, salary floor/ceiling, rounding, EC add-on)
 *   statutory_brackets — one row per salary/income band
 *
 * `computation_type` drives how the engine reads them:
 *   flat_percentage    — single EE/ER rate applied to a floor/ceiling-capped salary (SSS, PhilHealth)
 *   tiered_percentage  — EE/ER rate varies by salary band (Pag-IBIG); bracket rows carry the rates
 *   fixed_bracket      — fixed peso EE/ER/EC per salary band (an actual SSS contribution table)
 *   tax_bracket        — base tax + marginal rate on the excess over the band's lower bound (BIR)
 *
 * Fully reversible: `down` rebuilds the old JSON shape from the structured data.
 *
 * @param { import("knex").Knex } knex
 */

const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};
const round6 = (x) => Math.round(n(x) * 1e6) / 1e6;

// Known-good structured defaults per statutory type — used only when a row has no
// JSON to convert (e.g. after a rollback wiped it). Mirrors the original seed.
const DEFAULTS = {
    sss: {
        patch: { computation_type: 'flat_percentage', employee_rate: 0.05, employer_rate: 0.10, salary_floor: 5000, salary_ceiling: 35000, salary_rounding: 500, ec_amount: 10 },
        brackets: [],
    },
    philhealth: {
        patch: { computation_type: 'flat_percentage', employee_rate: 0.025, employer_rate: 0.025, salary_floor: 10000, salary_ceiling: 100000 },
        brackets: [],
    },
    pagibig: {
        patch: { computation_type: 'tiered_percentage', salary_ceiling: 10000 },
        brackets: [
            { lower_bound: 0, upper_bound: 1500, employee_rate: 0.01, employer_rate: 0.02, sort_order: 0 },
            { lower_bound: 1500.01, upper_bound: null, employee_rate: 0.02, employer_rate: 0.02, sort_order: 1 },
        ],
    },
    withholding_tax: {
        patch: { computation_type: 'tax_bracket' },
        brackets: [
            { lower_bound: 0, upper_bound: 20833, base_tax: 0, tax_rate: 0, sort_order: 0 },
            { lower_bound: 20833, upper_bound: 33332, base_tax: 0, tax_rate: 0.15, sort_order: 1 },
            { lower_bound: 33333, upper_bound: 66666, base_tax: 1875, tax_rate: 0.20, sort_order: 2 },
            { lower_bound: 66667, upper_bound: 166666, base_tax: 8541.80, tax_rate: 0.25, sort_order: 3 },
            { lower_bound: 166667, upper_bound: 666666, base_tax: 33541.80, tax_rate: 0.30, sort_order: 4 },
            { lower_bound: 666667, upper_bound: null, base_tax: 183541.80, tax_rate: 0.35, sort_order: 5 },
        ],
    },
};

exports.up = async function (knex) {
    // 1. Scalar columns on the parent -----------------------------------------------
    await knex.schema.withSchema('payroll').alterTable('statutory_tables', (t) => {
        t.enum('computation_type', ['fixed_bracket', 'flat_percentage', 'tiered_percentage', 'tax_bracket'])
            .notNullable().defaultTo('flat_percentage');
        t.decimal('employee_rate', 9, 6).nullable();   // fraction, e.g. 0.025 = 2.5%
        t.decimal('employer_rate', 9, 6).nullable();
        t.decimal('salary_floor', 14, 2).nullable();
        t.decimal('salary_ceiling', 14, 2).nullable();
        t.decimal('salary_rounding', 14, 2).nullable();
        t.decimal('ec_amount', 14, 2).nullable();
    });

    // 2. Child bracket table ------------------------------------------------------
    await knex.schema.withSchema('payroll').createTable('statutory_brackets', (t) => {
        t.bigIncrements('id').primary();
        t.uuid('uuid').defaultTo(knex.raw('gen_random_uuid()')).unique().index();

        t.bigInteger('statutory_table_id').unsigned().notNullable()
            .references('id').inTable('payroll.statutory_tables').onDelete('CASCADE');

        t.decimal('lower_bound', 14, 2).notNullable().defaultTo(0);
        t.decimal('upper_bound', 14, 2).nullable(); // null = no upper limit

        t.decimal('employee_amount', 14, 2).nullable();  // fixed_bracket
        t.decimal('employer_amount', 14, 2).nullable();
        t.decimal('ec_amount', 14, 2).nullable();

        t.decimal('employee_rate', 9, 6).nullable();     // tiered_percentage
        t.decimal('employer_rate', 9, 6).nullable();

        t.decimal('base_tax', 14, 2).nullable();         // tax_bracket
        t.decimal('tax_rate', 9, 6).nullable();

        t.integer('sort_order').notNullable().defaultTo(0);

        t.boolean('is_deleted').notNullable().defaultTo(false);
        t.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        t.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees').onDelete('SET NULL');
        t.timestamps(true, true);

        t.index(['statutory_table_id', 'sort_order']);
    });

    // 3. Convert each row from its old JSON --------------------------------------
    const rows = await knex('payroll.statutory_tables').select('*');
    for (const row of rows) {
        const cfg = row.config || {};
        const oldBrackets = Array.isArray(row.brackets) ? row.brackets : [];
        const hasJson = Object.keys(cfg).length > 0 || oldBrackets.length > 0;

        if (!hasJson && DEFAULTS[row.type]) {
            const d = DEFAULTS[row.type];
            await knex('payroll.statutory_tables').where('id', row.id).update(d.patch);
            if (d.brackets.length) {
                await knex('payroll.statutory_brackets').insert(d.brackets.map((b) => ({ ...b, statutory_table_id: row.id })));
            }
            continue;
        }

        const patch = {};
        const bracketRows = [];

        if (row.type === 'withholding_tax') {
            patch.computation_type = 'tax_bracket';
            oldBrackets.forEach((b, i) => bracketRows.push({
                statutory_table_id: row.id,
                lower_bound: n(b.min),
                upper_bound: b.max === null || b.max === undefined ? null : n(b.max),
                base_tax: n(b.base_tax),
                tax_rate: n(b.rate),
                sort_order: i,
            }));
        } else if (row.type === 'pagibig') {
            patch.computation_type = 'tiered_percentage';
            patch.salary_ceiling = n(cfg.fund_salary_ceiling) || null;
            const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
            let lower = 0;
            tiers.forEach((tier, i) => {
                const upper = tier.up_to === null || tier.up_to === undefined ? null : n(tier.up_to);
                bracketRows.push({
                    statutory_table_id: row.id,
                    lower_bound: lower,
                    upper_bound: upper,
                    employee_rate: n(tier.employee_rate),
                    employer_rate: n(tier.employer_rate),
                    sort_order: i,
                });
                lower = upper === null ? lower : upper + 0.01;
            });
        } else if (row.type === 'philhealth') {
            patch.computation_type = 'flat_percentage';
            const total = n(cfg.total_rate);
            const eeShare = cfg.employee_share === undefined ? 0.5 : n(cfg.employee_share);
            patch.employee_rate = round6(total * eeShare) || null;
            patch.employer_rate = round6(total * (1 - eeShare)) || null;
            patch.salary_floor = n(cfg.salary_floor) || null;
            patch.salary_ceiling = n(cfg.salary_ceiling) || null;
        } else { // sss
            patch.computation_type = 'flat_percentage';
            patch.employee_rate = n(cfg.employee_rate) || null;
            patch.employer_rate = n(cfg.employer_rate) || null;
            patch.salary_floor = n(cfg.msc_floor) || null;
            patch.salary_ceiling = n(cfg.msc_ceiling) || null;
            patch.salary_rounding = n(cfg.round_msc_to) || null;
            patch.ec_amount = n(cfg.ec_amount) || null;
        }

        await knex('payroll.statutory_tables').where('id', row.id).update(patch);
        if (bracketRows.length) await knex('payroll.statutory_brackets').insert(bracketRows);
    }

    // 4. Drop the JSON columns -------------------------------------------------
    await knex.schema.withSchema('payroll').alterTable('statutory_tables', (t) => {
        t.dropColumn('brackets');
        t.dropColumn('config');
    });
};

exports.down = async function (knex) {
    await knex.schema.withSchema('payroll').alterTable('statutory_tables', (t) => {
        t.jsonb('brackets').notNullable().defaultTo(JSON.stringify([]));
        t.jsonb('config').nullable();
    });

    // Rebuild the old JSON shape so a subsequent `up` can convert it back.
    const rows = await knex('payroll.statutory_tables').select('*');
    for (const row of rows) {
        const brackets = await knex('payroll.statutory_brackets')
            .where({ statutory_table_id: row.id, is_deleted: false })
            .orderBy('sort_order', 'asc');

        let config = null;
        let jsonBrackets = [];

        if (row.computation_type === 'tax_bracket') {
            config = { mode: 'annualized_brackets' };
            jsonBrackets = brackets.map((b) => ({
                min: n(b.lower_bound),
                max: b.upper_bound === null ? null : n(b.upper_bound),
                base_tax: n(b.base_tax),
                rate: n(b.tax_rate),
                excess_over: n(b.lower_bound),
            }));
        } else if (row.computation_type === 'tiered_percentage') {
            config = {
                mode: 'bracket_percentage',
                fund_salary_ceiling: n(row.salary_ceiling),
                tiers: brackets.map((b) => ({
                    up_to: b.upper_bound === null ? null : n(b.upper_bound),
                    employee_rate: n(b.employee_rate),
                    employer_rate: n(b.employer_rate),
                })),
            };
        } else if (row.computation_type === 'fixed_bracket') {
            config = {};
            jsonBrackets = brackets.map((b) => ({
                min: n(b.lower_bound),
                max: b.upper_bound === null ? null : n(b.upper_bound),
                employee: n(b.employee_amount),
                employer: n(b.employer_amount),
                ec: n(b.ec_amount),
            }));
        } else { // flat_percentage
            config = { mode: 'percentage', employee_rate: n(row.employee_rate), employer_rate: n(row.employer_rate) };
            if (row.type === 'sss') {
                config.ec_amount = n(row.ec_amount);
                config.msc_floor = n(row.salary_floor);
                config.msc_ceiling = n(row.salary_ceiling);
                config.round_msc_to = n(row.salary_rounding);
            } else {
                config.total_rate = round6(n(row.employee_rate) + n(row.employer_rate));
                config.employee_share = 0.5;
                config.salary_floor = n(row.salary_floor);
                config.salary_ceiling = n(row.salary_ceiling);
            }
        }

        await knex('payroll.statutory_tables').where('id', row.id).update({
            config: JSON.stringify(config),
            brackets: JSON.stringify(jsonBrackets),
        });
    }

    await knex.schema.withSchema('payroll').dropTableIfExists('statutory_brackets');
    await knex.schema.withSchema('payroll').alterTable('statutory_tables', (t) => {
        t.dropColumn('computation_type');
        t.dropColumn('employee_rate');
        t.dropColumn('employer_rate');
        t.dropColumn('salary_floor');
        t.dropColumn('salary_ceiling');
        t.dropColumn('salary_rounding');
        t.dropColumn('ec_amount');
    });
};
