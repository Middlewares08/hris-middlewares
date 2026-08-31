// database/models/employee/EmployeeGovernmentDetails.js
const BaseModel = require('../BaseModel');
const { encrypt, decrypt } = require('../../../utils/crypto');


// ENCRYPT ON SAVE/UPDATE
function processEncryption(instance) {
    if (instance.tin_number) instance.tin_number = encrypt(instance.tin_number);
    if (instance.sss_number) instance.sss_number = encrypt(instance.sss_number);
    if (instance.philhealth_number) instance.philhealth_number = encrypt(instance.philhealth_number);
    if (instance.pagibig_number) instance.pagibig_number = encrypt(instance.pagibig_number);
}

// Decrypt tolerantly: a value written under a rotated/old key (or a legacy
// plaintext value) must never blow up a read — hand back null instead so the
// caller can prompt the employee to re-enter it.
function safeDecrypt(value) {
    if (!value) return value;
    try { return decrypt(value); } catch (_) { return null; }
}

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
        processEncryption(this);
        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }
    }

    // Runs before updating to ensure timestamps sync up
    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        processEncryption(this);
        this.updated_at = new Date().toISOString();
    }

    $parseDatabaseJson(json) {
        json = super.$parseDatabaseJson(json);

        if (json.tin_number) json.tin_number = safeDecrypt(json.tin_number);
        if (json.sss_number) json.sss_number = safeDecrypt(json.sss_number);
        if (json.philhealth_number) json.philhealth_number = safeDecrypt(json.philhealth_number);
        if (json.pagibig_number) json.pagibig_number = safeDecrypt(json.pagibig_number);

        return json;
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