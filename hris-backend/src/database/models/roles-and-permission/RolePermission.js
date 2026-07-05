// database/models/role_permission/RolePermission.js
const BaseModel = require('../BaseModel');

class RolePermission extends BaseModel {
    static get tableName() {
        return 'role_permission.role_permissions';
    }

    static get idColumn() {
        return 'id';
    }

    static get relationMappings() {
        const Role = require('./Role');
        const Permission = require('./Permission');

        return {
            role: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Role,
                join: {
                    from: 'role_permission.role_permissions.role_id',
                    to: 'role_permission.roles.id'
                }
            },
            permission: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Permission,
                join: {
                    from: 'role_permission.role_permissions.permission_id',
                    to: 'role_permission.permissions.id'
                }
            }
        };
    }
}

module.exports = RolePermission;