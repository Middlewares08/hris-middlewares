const BaseModel = require('../BaseModel');

class Department extends BaseModel {
    static get tableName() {
        return 'lookups.departments'; // 🎯 Updated Schema
    }

    static get idColumn() {
        return 'id';
    }

    // 🎯 Helper method to clean up strings into url slugs
    generateSlug(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove all special characters
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with a single hyphen
            .replace(/^-+|-+$/g, ''); // Trim trailing/leading hyphens
    }

    // Automatically format code to uppercase on the database level before it inserts
    async $beforeInsert(queryContext) {
        await super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        
        if (this.code) {
            this.code = this.code.toUpperCase().trim();
        }

        if (this.name) {
            this.slug = this.generateSlug(this.name);
        }
    }

    async $beforeUpdate(opt, queryContext) {
        await super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();

        if (this.code) {
            this.code = this.code.toUpperCase().trim();
        }

        if (this.name) {
            this.slug = this.generateSlug(this.name);
        }
    }

    static get jsonSchema() {
        return {
        type: 'object',
        required: ['name', 'code'],
        properties: {
                id: { type: 'integer' },
                uuid: { type: 'string', format: 'uuid' },
                slug: { type: 'string' },
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