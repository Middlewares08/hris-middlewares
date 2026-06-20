const knex = require('knex');
const knexConfig = require('../../knexfile');

// Use the development configuration environment
const connection = knex(knexConfig.development);

module.exports = connection;