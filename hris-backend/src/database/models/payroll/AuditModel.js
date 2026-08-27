// database/models/payroll/AuditModel.js
//
// Shared base for every payroll model. Stamps the audit trail automatically:
//   - created_at / updated_at   (ISO timestamps)
//   - created_by / updated_by   (from queryContext.user.id, when the caller sets it
//                                via `.context({ user: req.user })` — otherwise the
//                                controller passes them explicitly in the payload)
//
// Mirrors the hook style already used across the codebase (see attendance/LeaveRequest).
const BaseModel = require('../BaseModel');

class AuditModel extends BaseModel {
    // Reusable query modifier: `.modify('notDeleted')` -> WHERE <table>.is_deleted = false
    static get modifiers() {
        return {
            notDeleted: (query) => {
                query.where(`${query.modelClass().tableName}.is_deleted`, false);
            },
        };
    }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);

        const nowIso = new Date().toISOString();
        if (this.created_at === undefined) this.created_at = nowIso;
        if (this.updated_at === undefined) this.updated_at = nowIso;

        const actorId = Number(queryContext?.user?.id) || null;
        if (actorId && this.created_by === undefined) this.created_by = actorId;
        if (actorId && this.updated_by === undefined) this.updated_by = actorId;
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);

        this.updated_at = new Date().toISOString();

        const actorId = Number(queryContext?.user?.id) || null;
        if (actorId && this.updated_by === undefined) this.updated_by = actorId;
    }
}

module.exports = AuditModel;
