// database/models/attendance/FaceLivenessSession.js
const BaseModel = require('../BaseModel');

class FaceLivenessSession extends BaseModel {
    static get tableName() { return 'attendance.face_liveness_sessions'; }
    static get idColumn() { return 'id'; }

    $beforeInsert() {
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;
    }

    $beforeUpdate() {
        this.updated_at = new Date().toISOString();
    }
}

module.exports = FaceLivenessSession;
