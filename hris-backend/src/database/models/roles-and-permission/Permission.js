// database/models/role_permission/Permission.js
const BaseModel = require('../BaseModel');

class Permission extends BaseModel {
    static get tableName() {
        return 'role_permission.permissions';
    }

    static get idColumn() {
        return 'id';
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