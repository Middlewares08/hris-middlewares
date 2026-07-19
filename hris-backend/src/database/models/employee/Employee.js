// database/models/employee/Employee.js
const BaseModel = require('../BaseModel');

class Employee extends BaseModel {
    // 💡 FIX: Explicitly namespace the table name string here
    static get tableName() { return 'employee.employees'; } 
    static get idColumn() { return 'id'; }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }
    }
   

    async $afterInsert(queryContext) {
        const Role = require('../roles-and-permission/Role');

        // Essential: Run super to trigger any parent BaseModel logic
        await super.$afterInsert(queryContext);

        // 1. Check if relation graph payloads were provided in the initial query context
        const graphData = queryContext.graphData;
        if (!graphData) return;

        // 2. Extract transaction (trx) or knex connection context from the parent query
        const trx = queryContext.transaction;

        // 3. Chain graph operations directly to the newly created employee record instance (`this`)
        await this.$relatedQuery('contact', trx).insert(graphData.contact || {});
        await this.$relatedQuery('addresses', trx).insert(graphData.addresses || {});
        await this.$relatedQuery('demographics', trx).insert(graphData.demographics || {});
        await this.$relatedQuery('credentials', trx).insert(graphData.credentials || {});
        await this.$relatedQuery('governmentDetails', trx).insert(graphData.governmentDetails || {});


        // Relate existing roles and positions (pivot joins)
        if (graphData.roles?.length) {
            for (const role of graphData.roles) {
                await this.$relatedQuery('roles', trx).relate(role.id);
            }
        }
        if (graphData.position?.id) {
            await this.$relatedQuery('position', trx).relate(graphData.position.id);
        }

        try {
            // 2. Find the role matching slug = 'user' and is_deletable = false
            const userRole = await Role.query(trx)
                .findOne({ 
                    slug: 'user', 
                    is_deletable: false 
                });

            // Safety check: if the role doesn't exist in the DB, throw an error to rollback
            if (!userRole) {
                throw new Error("Default 'user' role could not be found in the database.");
            }

            // 3. Relate the newly created employee to the found role via the pivot table
            // '$relate' automatically uses the current employee's primary key (this.id)
            await this.$relatedQuery('roles', trx).relate(userRole.id);

        } catch (error) {
            // Re-throw the error so Objection rolls back the parent transaction safely
            throw error;
        }
    }

    // 🎯 Runs automatically right before a PUT / PATCH update operation hits the DB
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();

        if (queryContext.user) {
            this.updated_by = queryContext.user.id;
        }
    }

    static get relationMappings() {
        const Contact = require('./Contact');
        const Demographic = require('./Demographic');
        const Address = require('./Address');
        const Credentials = require('./Credential');
        const Role = require('../roles-and-permission/Role');
        const Position = require('../lookups/Position');
        const GovernmentDetail = require('./GovernmentDetail');

        return {
            contact: {
                relation: BaseModel.HasOneRelation,
                modelClass: Contact,
                // 💡 Match the table names directly
                join: { from: 'employee.employees.id', to: 'employee.contacts.employee_id' }
            },
            demographics: {
                relation: BaseModel.HasOneRelation,
                modelClass: Demographic,
                join: { from: 'employee.employees.id', to: 'employee.demographics.employee_id' }
            },
            addresses: {
                relation: BaseModel.HasManyRelation,
                modelClass: Address,
                join: { from: 'employee.employees.id', to: 'employee.addresses.employee_id' }
            },
            credentials: {
                relation: BaseModel.HasOneRelation,
                modelClass: Credentials,
                join: { from: 'employee.employees.id', to: 'employee.credentials.employee_id' },
                modify: (builder) => builder.select('employee_id', 'email')
            },
            roles: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: Role,
                join: {
                    from: 'employee.employees.id', 
                    through: {
                        from: 'role_permission.employee_roles.employee_id', 
                        to: 'role_permission.employee_roles.role_id'
                    },
                    to: 'role_permission.roles.id'
                }
            },
            position: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: Position,
                join: {
                    from: 'employee.employees.id', 
                    through: {
                        from: 'employee.positions.employee_id',
                        to: 'employee.positions.position_id'
                    },
                    to: 'lookups.positions.id'
                }
            },
            governmentDetails: {
                relation: BaseModel.HasOneRelation,
                modelClass: GovernmentDetail,
                join: {
                    from: 'employee.employees.id', // Owner table column
                    to: 'employee.government_details.employee_id' // Related table column
                }
            }
        };
    }
}

module.exports = Employee;