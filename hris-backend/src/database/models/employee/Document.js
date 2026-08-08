const BaseModel = require('../BaseModel');

class Document extends BaseModel {
    static get tableName() {
        return 'employee.documents';
    }

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['employee_id', 'label', 'type', 'file_link'],
            properties: {
                id: { type: 'integer' },
                employee_id: { type: ['integer', 'string'] },
                label: { type: 'string', minLength: 1, maxLength: 255 },
                type: { type: 'string', enum: ['pdf', 'image'] },
                file_link: { type: 'string', minLength: 1 },
                is_deleted: { type: 'boolean' }
            }
        };
    }

    static get relationMappings() {
        const Employee = require('./Employee'); // Adjust path to your Employee model if needed
        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.documents.employee_id',
                    to: 'employee.employees.id'
                }
            }
        };
    }
}

module.exports = Document;