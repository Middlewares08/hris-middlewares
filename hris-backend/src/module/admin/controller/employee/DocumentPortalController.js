const Document = require('../../../../database/models/employee/Document');
const DocumentRequest = require('../../../../database/models/employee/DocumentRequest');
const { logActivity } = require('../../../../utils/activityLogger');
const { notifyDocumentRequested } = require('../../../../utils/notify');
const {
    uploadBuffer,
    deleteObject,
    resolveFileUrl,
    isDataUri,
    isStoredKey,
} = require('../../../../utils/storage');
const { MAX_FILE_BYTES } = require('../../../../middleware/uploadMiddleware');

const TYPES = Document.TYPES;

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v || ''));

const fileKind = (mime) => (String(mime || '').startsWith('image/') ? 'image' : 'pdf');

/* ============================================================
 * File intake + presigned URL helpers
 * ========================================================== */

/**
 * Turn whatever the client sent into an S3 object and return the row fields it
 * maps to. Supports two shapes:
 *   1. multipart/form-data `file` field  (hris-user PWA)
 *   2. legacy base64 data URI in `file_link`  (admin frontend, older clients)
 * Returns `null` when no new file was supplied. Throws on a bad payload.
 */
async function persistIncomingFile(req, employeeId) {
    const keySegments = ['documents', 'employee', employeeId];

    // (1) real multipart upload
    if (req.file) {
        const key = await uploadBuffer({
            buffer: req.file.buffer,
            contentType: req.file.mimetype,
            keySegments,
            fileName: req.file.originalname,
        });
        return {
            file_link: key,
            type: fileKind(req.file.mimetype),
            file_name: req.file.originalname ? String(req.file.originalname).slice(0, 255) : null,
            size_bytes: req.file.size,
        };
    }

    // (2) legacy base64 data URI
    const { file_link } = req.body;
    if (isDataUri(file_link)) {
        const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(String(file_link));
        if (!match) {
            const err = new Error('Malformed file payload.');
            err.status = 400;
            throw err;
        }
        const contentType = match[1] || 'application/octet-stream';
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > MAX_FILE_BYTES) {
            const err = new Error(`File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`);
            err.status = 400;
            throw err;
        }
        const key = await uploadBuffer({
            buffer,
            contentType,
            keySegments,
            fileName: req.body.file_name || 'document',
        });
        return {
            file_link: key,
            type: TYPES.includes(req.body.type) ? req.body.type : fileKind(contentType),
            file_name: req.body.file_name ? String(req.body.file_name).slice(0, 255) : null,
            size_bytes: buffer.length,
        };
    }

    return null;
}

/** Attach a browser-openable `file_url` (presigned or legacy data URI) to a document. */
const withFileUrl = async (doc) => {
    if (!doc) return doc;
    const json = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
    return {
        ...json,
        file_url: await resolveFileUrl(json.file_link, {
            fileName: json.file_name || json.label,
        }),
    };
};

const withFileUrls = (docs = []) => Promise.all(docs.map(withFileUrl));

/** Same, but for a document request whose `fulfilledDocument` may need presigning. */
const withRequestFileUrl = async (request) => {
    if (!request) return request;
    const json = typeof request.toJSON === 'function' ? request.toJSON() : request;
    if (json.fulfilledDocument) {
        json.fulfilledDocument = await withFileUrl(json.fulfilledDocument);
    }
    return json;
};

const withRequestFileUrls = (requests = []) => Promise.all(requests.map(withRequestFileUrl));

/* ============================================================
 * SELF-SERVICE (authenticated employee — no admin permission)
 * ========================================================== */

const getMyDocuments = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        const documents = await Document.query()
            .where({ employee_id: employeeId, is_deleted: false })
            .withGraphFetched('request')
            .orderBy('created_at', 'desc');

        return res.status(200).json({ success: true, data: await withFileUrls(documents) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const getMyDocumentRequests = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        const requests = await DocumentRequest.query()
            .where({ employee_id: employeeId, is_deleted: false })
            .whereNot('status', 'cancelled')
            .withGraphFetched('[requester, reviewer, fulfilledDocument]')
            .orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
            .orderBy('created_at', 'desc');

        return res.status(200).json({ success: true, data: await withRequestFileUrls(requests) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** Employee asks HR for a document (COE, ITR copy, …). */
const createMyDocumentRequest = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        const { label, note } = req.body;
        if (!label || !String(label).trim()) {
            return res.status(400).json({ success: false, message: 'label is required.' });
        }
        if (String(label).trim().length > 200) {
            return res.status(400).json({ success: false, message: 'label must be 200 characters or fewer.' });
        }

        const request = await DocumentRequest.query().context({ user: { id: employeeId } }).insertAndFetch({
            employee_id: employeeId,
            label: String(label).trim(),
            note: note ? String(note).trim().slice(0, 500) : null,
            status: 'pending',
            source: 'employee',
        });

        await logActivity({
            employeeId,
            action: 'document.request_raised',
            category: 'document',
            description: `Requested "${request.label}" from HR`,
            metadata: { document_request_uuid: request.uuid },
            req,
        });

        return res.status(201).json({ success: true, data: request });
    } catch (error) {
        console.error('Create my document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** Employee withdraws their own still-pending request to HR. */
const cancelMyDocumentRequest = async (req, res) => {
    try {
        const employeeId = actorId(req);
        const { id } = req.params;

        const request = await DocumentRequest.query()
            .findById(id)
            .where({ employee_id: employeeId, source: 'employee', is_deleted: false });
        if (!request) return res.status(404).json({ success: false, message: 'Document request not found.' });
        if (request.status !== 'pending') {
            return res.status(409).json({ success: false, message: `A ${request.status} request can no longer be cancelled.` });
        }

        const updated = await DocumentRequest.query().context({ user: { id: employeeId } })
            .patchAndFetchById(id, { status: 'cancelled' });

        await logActivity({
            employeeId,
            action: 'document.request_withdrawn',
            category: 'document',
            description: `Withdrew the request for "${request.label}"`,
            metadata: { document_request_uuid: request.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Cancel my document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const uploadMyDocument = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        const { label, document_request_id } = req.body;
        if (!label || !String(label).trim()) {
            return res.status(400).json({ success: false, message: 'label is required.' });
        }
        if (String(label).trim().length > 200) {
            return res.status(400).json({ success: false, message: 'label must be 200 characters or fewer.' });
        }

        let request = null;
        if (document_request_id) {
            request = await DocumentRequest.query()
                .findById(document_request_id)
                .where({ employee_id: employeeId, is_deleted: false });
            if (!request) return res.status(404).json({ success: false, message: 'Linked document request not found.' });
            if (request.status !== 'pending') {
                return res.status(409).json({ success: false, message: 'That request is no longer open.' });
            }
        }

        let fileData;
        try {
            fileData = await persistIncomingFile(req, employeeId);
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
        if (!fileData) return res.status(400).json({ success: false, message: 'A file is required.' });

        const document = await Document.query().context({ user: { id: employeeId } }).insertAndFetch({
            employee_id: employeeId,
            label: String(label).trim(),
            source: 'employee',
            document_request_id: request ? request.id : null,
            ...fileData,
        });

        if (request) {
            await DocumentRequest.query().context({ user: { id: employeeId } }).patchAndFetchById(request.id, {
                status: 'fulfilled',
                fulfilled_document_id: document.id,
                fulfilled_at: new Date().toISOString(),
            });
        }

        await logActivity({
            employeeId,
            action: request ? 'document.request_fulfilled' : 'document.uploaded',
            category: 'document',
            description: request
                ? `Submitted "${document.label}" for the requested document`
                : `Uploaded document "${document.label}"`,
            metadata: { document_id: document.id, document_request_id: request?.id || null },
            req,
        });

        return res.status(201).json({ success: true, data: await withFileUrl(document) });
    } catch (error) {
        console.error('Upload my document error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateMyDocument = async (req, res) => {
    try {
        const employeeId = actorId(req);
        const { id } = req.params;

        const document = await Document.query().findById(id).where({ employee_id: employeeId, is_deleted: false });
        if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });

        const { label } = req.body;
        if (label !== undefined && (!label || !String(label).trim())) {
            return res.status(400).json({ success: false, message: 'label cannot be empty.' });
        }

        let fileData = null;
        try {
            fileData = await persistIncomingFile(req, employeeId);
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }

        const updated = await Document.query().context({ user: { id: employeeId } }).patchAndFetchById(id, {
            label: label === undefined ? undefined : String(label).trim(),
            ...(fileData || {}),
        });

        // A new file replaced the old one — drop the now-orphaned S3 object.
        if (fileData && isStoredKey(document.file_link)) {
            await deleteObject(document.file_link);
        }

        await logActivity({
            employeeId,
            action: 'document.updated',
            category: 'document',
            description: `Updated document "${updated.label}"`,
            metadata: { document_id: updated.id },
            req,
        });

        return res.status(200).json({ success: true, data: await withFileUrl(updated) });
    } catch (error) {
        console.error('Update my document error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteMyDocument = async (req, res) => {
    try {
        const employeeId = actorId(req);
        const { id } = req.params;

        const document = await Document.query().findById(id).where({ employee_id: employeeId, is_deleted: false });
        if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });

        // Soft delete only — the S3 object is kept so an archived doc stays recoverable.
        await Document.query().context({ user: { id: employeeId } }).patchAndFetchById(id, { is_deleted: true });

        // If this document fulfilled a request, reopen it.
        await DocumentRequest.query()
            .patch({ status: 'pending', fulfilled_document_id: null, fulfilled_at: null, reviewed_by: null, reviewed_at: null })
            .where({ fulfilled_document_id: id, is_deleted: false });

        await logActivity({
            employeeId,
            action: 'document.deleted',
            category: 'document',
            description: `Removed document "${document.label}"`,
            metadata: { document_id: document.id },
            req,
        });

        return res.status(200).json({ success: true, message: 'Document removed.' });
    } catch (error) {
        console.error('Delete my document error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * ADMIN — gated by the 'employee-documents' module permissions
 * ========================================================== */

const listEmployeeDocuments = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const documents = await Document.query()
            .where({ employee_id, is_deleted: false })
            .withGraphFetched('[request, uploader]')
            .orderBy('created_at', 'desc');

        const requests = await DocumentRequest.query()
            .where({ employee_id, is_deleted: false })
            .withGraphFetched('[requester, reviewer, fulfilledDocument]')
            .orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
            .orderBy('created_at', 'desc');

        return res.status(200).json({
            success: true,
            data: {
                documents: await withFileUrls(documents),
                requests: await withRequestFileUrls(requests),
            },
        });
    } catch (error) {
        console.error('List employee documents error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving documents.' });
    }
};

const adminCreateDocument = async (req, res) => {
    try {
        const { employee_id, label, document_request_id } = req.body;
        if (!employee_id) return res.status(400).json({ success: false, message: 'employee_id is required.' });
        if (!label || !String(label).trim()) {
            return res.status(400).json({ success: false, message: 'label is required.' });
        }

        // When fulfilling an employee's request, the upload is linked back to it.
        let request = null;
        if (document_request_id) {
            request = await DocumentRequest.query()
                .findById(document_request_id)
                .where({ is_deleted: false });
            if (!request) return res.status(404).json({ success: false, message: 'Linked document request not found.' });
            if (Number(request.employee_id) !== Number(employee_id)) {
                return res.status(400).json({ success: false, message: 'That request belongs to another employee.' });
            }
            if (request.status !== 'pending') {
                return res.status(409).json({ success: false, message: 'That request is no longer open.' });
            }
        }

        let fileData;
        try {
            fileData = await persistIncomingFile(req, employee_id);
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
        if (!fileData) return res.status(400).json({ success: false, message: 'A file is required.' });

        const document = await Document.query().context({ user: { id: actorId(req) } }).insertAndFetch({
            employee_id,
            label: String(label).trim(),
            source: 'admin',
            document_request_id: request ? request.id : null,
            ...fileData,
        });

        if (request) {
            await DocumentRequest.query().context({ user: { id: actorId(req) } }).patchAndFetchById(request.id, {
                status: 'fulfilled',
                fulfilled_document_id: document.id,
                fulfilled_at: new Date().toISOString(),
                reviewed_by: actorId(req),
                reviewed_at: new Date().toISOString(),
            });
        }

        await logActivity({
            employeeId: parseInt(employee_id, 10),
            action: request ? 'document.request_fulfilled_by_admin' : 'document.added_by_admin',
            category: 'document',
            description: request
                ? `HR fulfilled the request for "${document.label}"`
                : `HR added document "${document.label}"`,
            metadata: { document_id: document.id, document_request_id: request?.id || null },
            req,
        });

        return res.status(201).json({ success: true, data: await withFileUrl(document) });
    } catch (error) {
        console.error('Admin create document error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** HR turns down an employee's document request with a reason. */
const declineDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { review_remarks } = req.body;

        const request = await DocumentRequest.query().findById(id).where('is_deleted', false);
        if (!request) return res.status(404).json({ success: false, message: 'Document request not found.' });
        if (request.source !== 'employee') {
            return res.status(400).json({ success: false, message: 'Only employee-raised requests can be declined.' });
        }
        if (request.status !== 'pending') {
            return res.status(409).json({ success: false, message: `A ${request.status} request can no longer be declined.` });
        }
        if (!review_remarks || !String(review_remarks).trim()) {
            return res.status(400).json({ success: false, message: 'A reason is required to decline a request.' });
        }

        const updated = await DocumentRequest.query().context({ user: { id: actorId(req) } }).patchAndFetchById(id, {
            status: 'declined',
            review_remarks: String(review_remarks).trim().slice(0, 500),
            reviewed_by: actorId(req),
            reviewed_at: new Date().toISOString(),
        });

        await logActivity({
            employeeId: request.employee_id,
            action: 'document.request_declined',
            category: 'document',
            description: `HR declined the request for "${request.label}"`,
            metadata: { document_request_uuid: request.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Decline document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const adminDeleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.query().findById(id).where('is_deleted', false);
        if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });

        // Soft delete only — the S3 object is retained for the archive.
        await Document.query().context({ user: { id: actorId(req) } }).patchAndFetchById(id, { is_deleted: true });
        await DocumentRequest.query()
            .patch({ status: 'pending', fulfilled_document_id: null, fulfilled_at: null, reviewed_by: null, reviewed_at: null })
            .where({ fulfilled_document_id: id, is_deleted: false });

        await logActivity({
            employeeId: document.employee_id,
            action: 'document.archived_by_admin',
            category: 'document',
            description: `HR removed document "${document.label}"`,
            metadata: { document_id: document.id },
            req,
        });

        return res.status(200).json({ success: true, message: 'Document archived.' });
    } catch (error) {
        console.error('Admin delete document error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const listAllDocumentRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const { search, employee_id, status, source } = req.query;
        const offset = (page - 1) * limit;

        let query = DocumentRequest.query()
            .where('employee.document_requests.is_deleted', false)
            .withGraphFetched('[employee, requester, reviewer, fulfilledDocument]');

        if (employee_id) query = query.where('employee_id', employee_id);
        if (status) query = query.where('status', status);
        if (source) query = query.where('source', source);
        if (search) {
            query = query.where((b) => {
                b.where('label', 'ilike', `%${search}%`)
                    .orWhereExists(DocumentRequest.relatedQuery('employee').where((s) => {
                        s.where('first_name', 'ilike', `%${search}%`).orWhere('last_name', 'ilike', `%${search}%`);
                    }));
            });
        }

        const result = await query.orderBy('created_at', 'desc').range(offset, offset + limit - 1);

        return res.status(200).json({
            success: true,
            data: await withRequestFileUrls(result.results),
            pagination: {
                totalRecords: result.total,
                currentPage: page,
                recordsPerPage: limit,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    } catch (error) {
        console.error('List document requests error:', error);
        return res.status(500).json({ success: false, message: 'Server error retrieving requests.' });
    }
};

const createDocumentRequest = async (req, res) => {
    try {
        const { employee_id, label, note, due_date } = req.body;
        if (!employee_id) return res.status(400).json({ success: false, message: 'employee_id is required.' });
        if (!label || !String(label).trim()) return res.status(400).json({ success: false, message: 'label is required.' });
        if (due_date != null && due_date !== '' && !isValidDate(due_date)) {
            return res.status(400).json({ success: false, message: 'due_date must be a valid date.' });
        }

        const request = await DocumentRequest.query().context({ user: { id: actorId(req) } }).insertAndFetch({
            employee_id,
            label: String(label).trim(),
            note: note ? String(note).trim().slice(0, 500) : null,
            due_date: due_date || null,
            status: 'pending',
            source: 'admin',
        });

        await logActivity({
            employeeId: parseInt(employee_id, 10),
            action: 'document.requested',
            category: 'document',
            description: `HR requested document "${request.label}"`,
            metadata: { document_request_uuid: request.uuid, due_date: request.due_date },
            req,
        });

        // Best-effort email to the employee — never blocks the response.
        notifyDocumentRequested({
            employeeId: parseInt(employee_id, 10),
            label: request.label,
            note: request.note,
            dueDate: request.due_date,
        });

        return res.status(201).json({ success: true, data: request });
    } catch (error) {
        console.error('Create document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const updateDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await DocumentRequest.query().findById(id).where('is_deleted', false);
        if (!request) return res.status(404).json({ success: false, message: 'Document request not found.' });
        if (request.status !== 'pending') {
            return res.status(409).json({ success: false, message: `A ${request.status} request can no longer be edited.` });
        }

        const { label, note, due_date } = req.body;
        if (due_date != null && due_date !== '' && !isValidDate(due_date)) {
            return res.status(400).json({ success: false, message: 'due_date must be a valid date.' });
        }

        const updated = await DocumentRequest.query().context({ user: { id: actorId(req) } }).patchAndFetchById(id, {
            label: label === undefined ? undefined : String(label).trim(),
            note: note === undefined ? undefined : (note ? String(note).trim().slice(0, 500) : null),
            due_date: due_date === undefined ? undefined : (due_date || null),
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Update document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const cancelDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await DocumentRequest.query().findById(id).where('is_deleted', false);
        if (!request) return res.status(404).json({ success: false, message: 'Document request not found.' });
        if (request.status === 'fulfilled') {
            return res.status(409).json({ success: false, message: 'A fulfilled request cannot be cancelled.' });
        }

        const updated = await DocumentRequest.query().context({ user: { id: actorId(req) } })
            .patchAndFetchById(id, { status: 'cancelled' });

        await logActivity({
            employeeId: request.employee_id,
            action: 'document.request_cancelled',
            category: 'document',
            description: `HR cancelled the request for "${request.label}"`,
            metadata: { document_request_uuid: request.uuid },
            req,
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Cancel document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const deleteDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await DocumentRequest.query().findById(id).where('is_deleted', false);
        if (!request) return res.status(404).json({ success: false, message: 'Document request not found.' });

        await DocumentRequest.query().context({ user: { id: actorId(req) } }).patchAndFetchById(id, { is_deleted: true });
        return res.status(200).json({ success: true, message: 'Document request removed.' });
    } catch (error) {
        console.error('Delete document request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    // self-service
    getMyDocuments,
    getMyDocumentRequests,
    createMyDocumentRequest,
    cancelMyDocumentRequest,
    uploadMyDocument,
    updateMyDocument,
    deleteMyDocument,
    // admin — documents
    listEmployeeDocuments,
    adminCreateDocument,
    adminDeleteDocument,
    // admin — requests
    listAllDocumentRequests,
    createDocumentRequest,
    updateDocumentRequest,
    cancelDocumentRequest,
    declineDocumentRequest,
    deleteDocumentRequest,
};
