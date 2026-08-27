// database/models/employee/ActivityLog.js
const BaseModel = require('../BaseModel');

class ActivityLog extends BaseModel {
    static get tableName() { return 'employee.activity_logs'; }
    static get idColumn() { return 'id'; }

    // JSON columns Objection should (de)serialise automatically
    static get jsonAttributes() { return ['metadata']; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }

        if (!this.category) {
            this.category = 'system';
        }
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
    }

    static get relationMappings() {
        const Employee = require('./Employee');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.activity_logs.employee_id',
                    to: 'employee.employees.id'
                },
                modify: (builder) => builder.select('id', 'uuid', 'first_name', 'last_name')
            }
        };
    }
}

module.exports = ActivityLog;
