const BaseModel = require('../BaseModel');

class Position extends BaseModel {
    static get tableName() {
        return 'lookups.positions';
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

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (this.name) {
            this.slug = this.generateSlug(this.name);
        }
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        
        // If the user changed the position name, regenerate the slug path vector automatically
        if (this.name) {
            this.slug = this.generateSlug(this.name);
        }
    }

    static get relationMappings() {
        const Department = require('./Department');
        return {
            department: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Department,
                join: {
                    from: 'lookups.positions.department_id',
                    to: 'lookups.departments.id'
                },
                modify: (builder) => builder.select('name', 'slug', 'uuid', 'code', 'description')
            }
        };
    }
}

module.exports = Position;