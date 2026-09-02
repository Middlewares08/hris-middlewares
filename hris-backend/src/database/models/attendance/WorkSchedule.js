// database/models/attendance/WorkSchedule.js
const BaseModel = require('../BaseModel');

class WorkSchedule extends BaseModel {
    static get tableName() { return 'attendance.work_schedules'; }
    static get idColumn() { return 'id'; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) this.created_by = queryContext.user.id;
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    static get relationMappings() {
        const WorkScheduleDay = require('./WorkScheduleDay');

        return {
            days: {
                relation: BaseModel.HasManyRelation,
                modelClass: WorkScheduleDay,
                join: {
                    from: 'attendance.work_schedules.id',
                    to: 'attendance.work_schedule_days.schedule_id',
                },
                modify: (b) => b.orderBy('weekday', 'asc'),
            },
        };
    }

    /** The schedule flagged as the org-wide fallback (with its weekday rows). */
    static defaultSchedule(trx) {
        return WorkSchedule.query(trx)
            .where({ is_default: true, is_deleted: false, is_active: true })
            .withGraphFetched('days')
            .first();
    }
}

module.exports = WorkSchedule;
