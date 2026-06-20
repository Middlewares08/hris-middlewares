const BaseModel = require('../BaseModel');

class EmployeeDemographic extends BaseModel {
  static get tableName() { return 'employee_demographics'; }
  static get schema() { return 'employee'; }
  static get idColumn() { return 'id'; }

  // Audit Stamp Hooks
  $beforeInsert(queryContext) {
    super.$beforeInsert(queryContext);
    if (queryContext.user) {
      this.created_by = queryContext.user.id;
    }
  }

  $beforeUpdate(opt, queryContext) {
    super.$beforeUpdate(opt, queryContext);
    if (queryContext.user) {
      this.updated_by = queryContext.user.id;
    }
  }
}

module.exports = EmployeeDemographic;