// database/models/employee/EmployeeGovernmentDetails.js
const BaseModel = require('../BaseModel');

class GovernmentDetails extends BaseModel {
    static get tableName() { 
        return 'employee.government_details'; 
    } 

    // 🎯 Overriding 'idColumn' because this table uses 'employee_id' as its PK
    static get idColumn() { 
        return 'employee_id'; 
    }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }
    }

    // Runs before updating to ensure timestamps sync up
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
    }

    // Default modifiers to avoid messy inline select builders
    static get modifiers() {
        return {
            // 🎯 Rename it uniquely to prevent parent/sibling class collision
            governmentSummary(builder) {
                builder.select(
                    'employee_id',
                    'tin_number',
                    'sss_number',
                    'philhealth_number',
                    'pagibig_number',
                    'is_sss_exempt',
                    'is_philhealth_exempt',
                    'is_pagibig_exempt'
                );
            }
        };
    }

    static get relationMappings() {
        const Employee = require('./Employee');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                    join: {
                        from: 'employee.government_details.employee_id',
                        to: 'employee.employees.id'
                }
            }
        };
    }
}

module.exports = GovernmentDetails;