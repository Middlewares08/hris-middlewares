// database/models/role_permission/EmployeeRole.js
const BaseModel = require('../BaseModel');

class EmployeeRole extends BaseModel {
    static get tableName() {
        return 'role_permission.employee_roles';
    }

    static get idColumn() {
        return 'id';
    }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        
        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }
    }

    static get relationMappings() {
        const Role = require('./Role');
        const Employee = require('../employee/Employee');

        return {
            role: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Role,
                join: {
                    from: 'role_permission.employee_roles.role_id',
                    to: 'role_permission.roles.id'
                }
            },
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'role_permission.employee_roles.employee_id',
                    to: 'employee.employees.id'
                }
            }
        };
    }
}

module.exports = EmployeeRole;