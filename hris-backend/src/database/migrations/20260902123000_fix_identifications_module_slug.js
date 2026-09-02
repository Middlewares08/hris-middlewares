/**
 * The Identifications module row shipped with a misspelled slug (`identfications`)
 * while its permissions and every UI gate use the correct `identifications:*`.
 * Align the module slug so the module seeder stops trying to insert a duplicate.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const typo = await knex('role_permission.modules').where({ slug: 'identfications' }).first();
    const correct = await knex('role_permission.modules').where({ slug: 'identifications' }).first();

    if (typo && !correct) {
        await knex('role_permission.modules')
            .where({ id: typo.id })
            .update({ slug: 'identifications', updated_at: knex.fn.now() });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const correct = await knex('role_permission.modules').where({ slug: 'identifications' }).first();
    const typo = await knex('role_permission.modules').where({ slug: 'identfications' }).first();

    if (correct && !typo) {
        await knex('role_permission.modules')
            .where({ id: correct.id })
            .update({ slug: 'identfications', updated_at: knex.fn.now() });
    }
};
