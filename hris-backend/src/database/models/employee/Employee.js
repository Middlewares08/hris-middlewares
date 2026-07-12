// database/models/employee/Employee.js
const BaseModel = require('../BaseModel');

class Employee extends BaseModel {
    // 💡 FIX: Explicitly namespace the table name string here
    static get tableName() { return 'employee.employees'; } 
    static get idColumn() { return 'id'; }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
    }

    static get relationMappings() {
        const Contact = require('./Contact');
        const Demographic = require('./Demographic');
        const Address = require('./Address');
        const Credentials = require('./Credential');

        return {
            contact: {
                relation: BaseModel.HasOneRelation,
                modelClass: Contact,
                // 💡 Match the table names directly
                join: { from: 'employee.employees.id', to: 'employee.contacts.employee_id' }
            },
            demographics: {
                relation: BaseModel.HasOneRelation,
                modelClass: Demographic,
                join: { from: 'employee.employees.id', to: 'employee.demographics.employee_id' }
            },
            addresses: {
                relation: BaseModel.HasManyRelation,
                modelClass: Address,
                join: { from: 'employee.employees.id', to: 'employee.addresses.employee_id' }
            },
            credentials: {
                relation: BaseModel.HasOneRelation,
                modelClass: Credentials,
                join: { from: 'employee.employees.id', to: 'employee.credentials.employee_id' }
            },
            roles: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('../roles-and-permission/Role'),
                join: {
                    from: 'employee.employees.id',
                    through: {
                        from: 'role_permission.employee_roles.employee_id',
                        to: 'role_permission.employee_roles.role_id'
                    },
                    to: 'role_permission.roles.id'
                }
            }
        };
    }
}

module.exports = Employee;