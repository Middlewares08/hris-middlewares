// database/models/role_permission/Role.js
const BaseModel = require('../BaseModel');

class Role extends BaseModel {
    static get tableName() {
        return 'role_permission.roles';
    }

    static get idColumn() {
        return 'id';
    }

    static get relationMappings() {
        const Permission = require('./Permission');
        const Employee = require('../employee/Employee');

        return {
            // Many-to-Many relation to permissions via role_permissions
            permissions: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: Permission,
                join: {
                    from: 'role_permission.roles.id',
                    through: {
                        from: 'role_permission.role_permissions.role_id',
                        to: 'role_permission.role_permissions.permission_id'
                    },
                    to: 'role_permission.permissions.id'
                }
            },
            // Many-to-Many relation to employees via employee_roles
            employees: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: Employee,
                join: {
                    from: 'role_permission.roles.id',
                    through: {
                        from: 'role_permission.employee_roles.role_id',
                        to: 'role_permission.employee_roles.employee_id'
                    },
                    to: 'employee.employees.id'
                }
            }
        };
    }

    /**
     * Fetches all roles alongside distinct employee and permission counts
     * @returns {Promise<Array>}
     */

    static async getSummary() {
        // 💡 Use this.knex() to leverage Objection's built-in query builder engine
        const db = this.knex();
        
        const roles = await this.query()
            .leftJoin('role_permission.employee_roles', 'role_permission.roles.id', 'role_permission.employee_roles.role_id')
            .leftJoin('role_permission.role_permissions', 'role_permission.roles.id', 'role_permission.role_permissions.role_id')
            .select([
                'role_permission.roles.id',
                'role_permission.roles.name',
                'role_permission.roles.slug',
                'role_permission.roles.is_deletable',
                'role_permission.roles.description',
                db.raw('COUNT(DISTINCT role_permission.employee_roles.employee_id) AS user_count'),
                db.raw('COUNT(DISTINCT role_permission.role_permissions.permission_id) AS permission_count'),
                // 🔑 NEW: Aggregates matching permission IDs into a clean JSON array string
                db.raw("COALESCE(JSON_AGG(role_permission.role_permissions.permission_id) FILTER (WHERE role_permission.role_permissions.permission_id IS NOT NULL), '[]') AS permission_id")
            ])
            .groupBy(
                'role_permission.roles.id', 
                'role_permission.roles.name', 
                'role_permission.roles.slug', 
                'role_permission.roles.is_deletable', // Added to group-by to remain fully SQL compliant
                'role_permission.roles.description'
            )
            .orderBy('role_permission.roles.name', 'asc');

        return roles.map(role => {
            // Handle duplicate values introduced by the cross-join matrix aggregation
            const uniquePermissionIds = Array.isArray(role.permission_id) 
                ? [...new Set(role.permission_id.map(Number))]
                : [];

            return {
                id: role.id,
                name: role.name,
                slug: role.slug,
                is_deletable: Boolean(role.is_deletable),
                description: role.description,
                user_count: parseInt(role.user_count, 10) || 0,
                permission_count: parseInt(role.permission_count, 10) || 0,
                permission_id: uniquePermissionIds // 🎯 Array of unique permission IDs: [1, 2, 3]
            };
        });
    }
}

module.exports = Role;