// database/models/attendance/Holiday.js
const BaseModel = require('../BaseModel');

const TYPES = ['regular', 'special_non_working', 'special_working'];

class Holiday extends BaseModel {
    static get tableName() { return 'attendance.holidays'; }
    static get idColumn() { return 'id'; }

    static get TYPES() { return TYPES; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) this.created_by = queryContext.user.id;
        if (!this.type) this.type = 'regular';
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    /** Active holiday rows with a date inside [from, to] (inclusive, 'YYYY-MM-DD'). */
    static inRange(trx, from, to) {
        return Holiday.query(trx)
            .where({ is_deleted: false, is_active: true })
            .where('date', '>=', String(from).substring(0, 10))
            .where('date', '<=', String(to).substring(0, 10))
            .orderBy('date', 'asc');
    }

    /** A non-working holiday landing on `date`, or undefined. `special_working` days
     *  are still work days, so they are ignored here. */
    static onDate(trx, date) {
        return Holiday.query(trx)
            .where({ is_deleted: false, is_active: true })
            .where('date', String(date).substring(0, 10))
            .whereIn('type', ['regular', 'special_non_working'])
            .first();
    }
}

module.exports = Holiday;
