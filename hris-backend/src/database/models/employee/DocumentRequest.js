const BaseModel = require('../BaseModel');

const STATUSES = ['pending', 'fulfilled', 'cancelled', 'declined'];
const SOURCES = ['admin', 'employee']; // 'admin' → HR asked the employee; 'employee' → employee asked HR

class DocumentRequest extends BaseModel {
    static get tableName() { return 'employee.document_requests'; }
    static get idColumn() { return 'id'; }

    static get STATUSES() { return STATUSES; }
    static get SOURCES() { return SOURCES; }

    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();
        this.updated_at = this.created_at;
        if (queryContext.user) this.created_by = queryContext.user.id;
        if (!this.status) this.status = 'pending';
        if (!this.source) this.source = 'admin';
    }

    $beforeUpdate(opt, queryContext) {
        super.$beforeUpdate(opt, queryContext);
        this.updated_at = new Date().toISOString();
        if (queryContext.user) this.updated_by = queryContext.user.id;
    }

    static get relationMappings() {
        const Employee = require('./Employee');
        const Document = require('./Document');

        const employeeSummary = (b) => b.select('id', 'uuid', 'first_name', 'last_name');

        return {
            employee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.document_requests.employee_id',
                    to: 'employee.employees.id',
                },
                modify: employeeSummary,
            },
            requester: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.document_requests.created_by',
                    to: 'employee.employees.id',
                },
                modify: employeeSummary,
            },
            reviewer: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'employee.document_requests.reviewed_by',
                    to: 'employee.employees.id',
                },
                modify: employeeSummary,
            },
            fulfilledDocument: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Document,
                join: {
                    from: 'employee.document_requests.fulfilled_document_id',
                    to: 'employee.documents.id',
                },
            },
        };
    }
}

module.exports = DocumentRequest;
