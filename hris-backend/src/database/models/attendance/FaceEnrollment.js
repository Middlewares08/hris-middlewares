// database/models/attendance/FaceEnrollment.js
const BaseModel = require('../BaseModel');

class FaceEnrollment extends BaseModel {
    static get tableName() { return 'attendance.face_enrollments'; }
    static get idColumn() { return 'id'; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
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

    static get relationMappings() {
        const Employee = require('../employee/Employee');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'attendance.face_enrollments.employee_id',
                    to: 'employee.employees.id',
                },
                modify: (builder) => builder.select('id', 'uuid', 'first_name', 'last_name'),
            },
        };
    }
}

module.exports = FaceEnrollment;
