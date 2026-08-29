const BaseModel = require('../BaseModel');

const TYPES = ['pdf', 'image'];
const SOURCES = ['admin', 'employee'];

class Document extends BaseModel {
    static get tableName() {
        return 'employee.documents';
    }

    static get TYPES() { return TYPES; }
    static get SOURCES() { return SOURCES; }

    static get jsonSchema() {
        return {
            type: 'object',
            required: ['employee_id', 'label', 'type', 'file_link'],
            properties: {
                id: { type: 'integer' },
                employee_id: { type: ['integer', 'string'] },
                label: { type: 'string', minLength: 1, maxLength: 255 },
                type: { type: 'string', enum: TYPES },
                file_link: { type: 'string', minLength: 1 },
                file_name: { type: ['string', 'null'], maxLength: 255 },
                size_bytes: { type: ['integer', 'string', 'null'] },
                source: { type: 'string', enum: SOURCES },
                document_request_id: { type: ['integer', 'string', 'null'] },
                is_deleted: { type: 'boolean' },
            },
        };
    }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;
        if (queryContext.user) this.created_by = queryContext.user.id;
        if (!this.source) this.source = 'admin';
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    static get relationMappings() {
        const Employee = require('./Employee');
        const DocumentRequest = require('./DocumentRequest');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.documents.employee_id',
                    to: 'employee.employees.id',
                },
            },
            request: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: DocumentRequest,
                join: {
                    from: 'employee.documents.document_request_id',
                    to: 'employee.document_requests.id',
                },
            },
            uploader: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.documents.created_by',
                    to: 'employee.employees.id',
                },
                modify: (b) => b.select('id', 'uuid', 'first_name', 'last_name'),
            },
        };
    }
}

module.exports = Document;
