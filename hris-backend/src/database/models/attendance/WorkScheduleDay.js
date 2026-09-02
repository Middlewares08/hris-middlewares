// database/models/attendance/WorkScheduleDay.js
const BaseModel = require('../BaseModel');

// One row per weekday of a work_schedule. `weekday` is 0=Sunday … 6=Saturday to
// match JS Date.getDay(). A row with end_time <= start_time is a night shift that
// rolls into the next calendar day.
class WorkScheduleDay extends BaseModel {
    static get tableName() { return 'attendance.work_schedule_days'; }
    static get idColumn() { return 'id'; }
}

module.exports = WorkScheduleDay;
