// database/models/role_permission/Permission.js
const BaseModel = require('../BaseModel');

class Permission extends BaseModel {
    static get tableName() {
        return 'role_permission.permissions';
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
        const Module = require('./Module');
        const Role = require('./Role');

        return {
            module: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Module,
                join: {
                    from: 'role_permission.permissions.module_id',
                    to: 'role_permission.modules.id'
                }
            },
            roles: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: Role,
                join: {
                    from: 'role_permission.permissions.id',
                    through: {
                        from: 'role_permission.role_permissions.permission_id',
                        to: 'role_permission.role_permissions.role_id'
                    },
                    to: 'role_permission.roles.id'
                }
            }
        };
    }

    // 🎯 Renamed to accurately reflect that you are querying by employee ID
    static async getPermissionsById(id) {
        if (!id) return [];

        const permissions = await this.query()
            .select('role_permission.permissions.slug')
            .joinRelated('roles') // 💡 This automatically joins and aliases the table as 'roles'
            .innerJoin(
                'role_permission.employee_roles as er', 
                'roles.id', // 🎯 FIX: Use the short alias 'roles.id' instead of the full schema prefix
                'er.role_id'
            )
            .where('role_permission.permissions.is_deleted', false)
            .where('er.employee_id', id);

        return [...new Set(permissions.map(p => p.slug))];
    }
}

module.exports = Permission;