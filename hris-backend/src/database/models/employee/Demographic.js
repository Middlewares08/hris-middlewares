const BaseModel = require('../BaseModel');

class Demographic extends BaseModel {
  static get tableName() { return 'employee.demographics'; }
  static get idColumn() { return 'id'; }

  // Audit Stamp Hooks
  $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
    this.created_at = new Date().toISOString();
    this.date_of_birth = new Date();
    this.gender = new Date().toISOString();
    this.nationality = 'N/A';
    
    if (queryContext.user) {
      this.created_by = queryContext.user.id;
    }
  }

  $beforeUpdate(opt, queryContext) {
    super.$beforeUpdate(opt, queryContext);
    this.updated_at = new Date().toISOString();
    if (queryContext.user) {
      this.updated_by = queryContext.user.id;
    }
  }
}

module.exports = Demographic;