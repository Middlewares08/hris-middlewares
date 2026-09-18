const BaseModel = require('../BaseModel');

class EducationalBackground extends BaseModel {
    static get tableName() { return 'employee.educational_backgrounds'; }
    static get idColumn() { return 'id'; }

    // Audit Stamp Hooks
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);

        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }
    }
}

module.exports = EducationalBackground;
