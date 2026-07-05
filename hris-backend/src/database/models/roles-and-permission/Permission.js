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
}

module.exports = Permission;