// database/models/announcement/Announcement.js
const BaseModel = require('../BaseModel');

const PRIORITIES = ['info', 'important', 'urgent'];
const STATUSES = ['draft', 'published', 'archived'];

class Announcement extends BaseModel {
    static get tableName() { return 'announcement.announcements'; }
    static get idColumn() { return 'id'; }

    static get PRIORITIES() { return PRIORITIES; }
    static get STATUSES() { return STATUSES; }

    // 🎯 Runs automatically right before a POST / insert operation hits the DB
    $beforeInsert(queryContext) {
        super.$beforeInsert(queryContext);
        this.created_at = new Date().toISOString();

        if (queryContext.user) {
            this.created_by = queryContext.user.id;
        }

        if (!this.priority) this.priority = 'info';
        if (!this.status) this.status = 'draft';

        // Stamp published_at the moment an entry is created already published
        if (this.status === 'published' && !this.published_at) {
            this.published_at = new Date().toISOString();
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

    /**
     * 👀 Scopes a query down to what an employee is allowed to see right now:
     * published, not deleted, and inside the [published_at, expires_at) window.
     */
    static visibleToEmployees(query, now = new Date().toISOString()) {
        return query
            .where('announcement.announcements.is_deleted', false)
            .where('announcement.announcements.status', 'published')
            .where((builder) => {
                builder.whereNull('published_at').orWhere('published_at', '<=', now);
            })
            .where((builder) => {
                builder.whereNull('expires_at').orWhere('expires_at', '>', now);
            });
    }

    static get relationMappings() {
        const Employee = require('../employee/Employee');

        const employeeSummary = (builder) =>
            builder.select('id', 'uuid', 'first_name', 'last_name');

        return {
            creator: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'announcement.announcements.created_by',
                    to: 'employee.employees.id'
                },
                modify: employeeSummary
            },
            editor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Employee,
                join: {
                    from: 'announcement.announcements.updated_by',
                    to: 'employee.employees.id'
                },
                modify: employeeSummary
            }
        };
    }
}

module.exports = Announcement;
