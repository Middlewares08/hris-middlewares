// database/connection.js
const { types } = require('pg');
const knex = require('knex');
const knexConfig = require('../../knexfile'); // Double-check this relative path to your knexfile
const { Model } = require('objection');

// 🎯 By default node-postgres parses DATE columns into local-midnight JS Date
// objects, which then serialize to a shifted UTC day in any timezone ahead of
// UTC (e.g. Asia/Manila). Return the raw 'YYYY-MM-DD' string instead.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Initialize Knex instance
const connection = knex(knexConfig.development);

// Bind Objection.js to this Knex instance globally
Model.knex(connection);

module.exports = connection;