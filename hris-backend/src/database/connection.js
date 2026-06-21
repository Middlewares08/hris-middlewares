// database/connection.js
const knex = require('knex');
const knexConfig = require('../../knexfile'); // Double-check this relative path to your knexfile
const { Model } = require('objection');

// Initialize Knex instance
const connection = knex(knexConfig.development);

// Bind Objection.js to this Knex instance globally
Model.knex(connection);

module.exports = connection;