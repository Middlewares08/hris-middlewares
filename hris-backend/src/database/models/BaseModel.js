const { Model } = require('objection');
const knex = require('../database/connection');

// Bind Objection to your active Knex instance once globally
Model.knex(knex);

module.exports = Model;