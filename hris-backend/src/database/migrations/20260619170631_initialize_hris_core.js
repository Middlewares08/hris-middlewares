/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    // 1. Enable UUID capabilities natively in Postgres for your ID strategy
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 2. Provision isolated logical schemas for each core tool
    await knex.raw('CREATE SCHEMA IF NOT EXISTS employee');

};


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    // Roll back schemas using CASCADE to drop all tables inside them if rolled back
    await knex.raw('DROP SCHEMA IF EXISTS employee CASCADE');
};