const BaseModel = require('../BaseModel');

class Employee extends BaseModel {
    static get tableName() { return 'employees'; }
    static get schema() { return 'employee'; }
    static get idColumn() { return 'id'; }

    // Relationship Mapping (Laravel-style Eager Loading)
    static get relationMappings() {
        const Contact = require('./EmployeeContact');
        const Demographic = require('./EmployeeDemographic');
        const Address = require('./EmployeeAddress');

        return {
        contact: {
            relation: BaseModel.HasOneRelation,
            modelClass: Contact,
            join: { from: 'employee.employees.id', to: 'employee.employee_contacts.employee_id' }
        },
        demographics: {
            relation: BaseModel.HasOneRelation,
            modelClass: Demographic,
            join: { from: 'employee.employees.id', to: 'employee.employee_demographics.employee_id' }
        },
        addresses: {
            relation: BaseModel.HasManyRelation,
            modelClass: Address,
            join: { from: 'employee.employees.id', to: 'employee.employee_addresses.employee_id' }
        }
        };
    }

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

module.exports = Employee;