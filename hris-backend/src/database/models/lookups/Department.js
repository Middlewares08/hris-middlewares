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

    static get relationMappings() {
        const Position = require('./Position');
        return {
            // 🎯 FIXED: Changed key name to 'positions' (plural) to represent what it holds
            positions: {
                // 🎯 FIXED: Changed to HasManyRelation since one department has multiple positions
                relation: BaseModel.HasManyRelation,
                modelClass: Position,
                join: {
                    from: 'lookups.departments.id',
                    to: 'lookups.positions.department_id'
                }
            }
        };
    }
}

module.exports = Department;