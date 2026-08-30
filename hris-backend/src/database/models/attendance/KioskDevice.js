// database/models/attendance/KioskDevice.js
const BaseModel = require('../BaseModel');

class KioskDevice extends BaseModel {
    static get tableName() { return 'attendance.kiosk_devices'; }
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
}

module.exports = KioskDevice;
