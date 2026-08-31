const BaseModel = require('../BaseModel');

class Contact extends BaseModel {
    static get tableName() { return 'employee.contacts'; }
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
        this.updated_at = new Date().toISOString();

        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }
    }
}

module.exports = Contact;