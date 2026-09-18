/**
 * Employee educational background — a 1:many list per employee (elementary
 * through graduate studies), captured at Add Employee time and self-managed
 * afterwards by the employee (see /auth/me/education).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.withSchema('employee').createTable('educational_backgrounds', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('employee_id').unsigned().notNullable()
            .references('id').inTable('employee.employees').onDelete('CASCADE');

        table.enum('education_level', ['elementary', 'secondary', 'vocational', 'college', 'graduate']).notNullable();
        table.string('school_name').notNullable();
        table.string('degree').nullable(); // course / degree earned, e.g. "BS Computer Science"
        table.integer('year_started').nullable();
        table.integer('year_graduated').nullable(); // left blank for "currently attending"
        table.string('honors').nullable();

        table.bigInteger('created_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.bigInteger('updated_by').unsigned().nullable()
            .references('id').inTable('employee.employees')
            .onDelete('SET NULL');

        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.withSchema('employee').dropTableIfExists('educational_backgrounds');
};
