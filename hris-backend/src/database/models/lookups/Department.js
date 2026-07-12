const BaseModel = require('../BaseModel');

class Department extends BaseModel {
    static get tableName() {
        return 'lookups.departments'; // 🎯 Updated Schema
    }

    static get idColumn() {
        return 'id';
    }

    // Automatically format code to uppercase on the database level before it inserts
    async $beforeInsert(queryContext) {
        await super.$beforeInsert(queryContext);
        if (this.code) {
            this.code = this.code.toUpperCase().trim();
        }
    }

    async $beforeUpdate(opt, queryContext) {
        await super.$beforeUpdate(opt, queryContext);
        if (this.code) {
            this.code = this.code.toUpperCase().trim();
        }
        
        this.updated_at = new Date().toISOString();
    }

    static get jsonSchema() {
        return {
        type: 'object',
        required: ['name', 'code'],
        properties: {
                id: { type: 'integer' },
                uuid: { type: 'string', format: 'uuid' },
                name: { type: 'string', minLength: 1, maxLength: 150 },
                code: { type: 'string', minLength: 2, maxLength: 50 },
                description: { type: ['string', 'null'], maxLength: 500 },
                is_deleted: { type: 'boolean' },
                created_by: { type: ['integer', 'null'] },
                updated_by: { type: ['integer', 'null'] }
            }
        };
    }
}

module.exports = Department;