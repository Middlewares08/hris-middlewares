// database/models/role_permission/Module.js
const BaseModel = require('../BaseModel');

class Module extends BaseModel {
    static get tableName() {
        return 'role_permission.modules';
    }

    static get idColumn() {
        return 'id';
    }

    static get relationMappings() {
        const Permission = require('./Permission');

        return {
            permissions: {
                relation: BaseModel.HasManyRelation,
                modelClass: Permission,
                join: {
                    from: 'role_permission.modules.id',
                    to: 'role_permission.permissions.module_id'
                }
            }
        };
    }
}

module.exports = Module;