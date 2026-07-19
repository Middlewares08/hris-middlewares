const BaseModel = require('../BaseModel');

class EmployeePosition extends BaseModel {
    static get tableName() {
        return 'employee.positions';
    }

    // Since this is a junction table with a composite primary key,
    // we tell Objection to look at both columns to identify unique rows.
    static get idColumn() {
        return ['employee_id', 'position_id'];
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
        const Employee = require('./Employee');
        const Position = require('../lookups/Position');
        const Department = require('../lookups/Department');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.positions.employee_id',
                    to: 'employee.employees.id'
                }
            },
            position: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Position,
                join: {
                    from: 'employee.positions.position_id',
                    to: 'lookups.positions.id'
                }
            }
        };
    }
}

module.exports = EmployeePosition;