const Document = require('../../../../database/models/employee/Document');

/**
 * 🔍 READ: Paginated List with Search Filter & File Type Filter
 */
const getAllDocuments = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', type } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        let query = Document.query()
            .withGraphFetched('employee')
            .where('is_deleted', false);

        // Filter by File Type (pdf / image)
        if (type && ['pdf', 'image'].includes(type.toLowerCase())) {
            query = query.where('type', type.toLowerCase());
        }

        // Search Filter (matches Document Label or Employee Name)
        if (search) {
            query = query.where((builder) => {
                builder.where('label', 'ilike', `%${search}%`)
                       .orWhereExists(
                           Document.relatedQuery('employee')
                                           .where('name', 'ilike', `%${search}%`)
                       );
            });
        }

        const result = await query
            .orderBy('created_at', 'desc')
            .page(pageNum - 1, limitNum);

        return res.status(200).json({
            success: true,
            data: result.results,
            pagination: {
                totalRecords: result.total,
                currentPage: pageNum,
                totalPages: Math.ceil(result.total / limitNum)
            }
        });
    } catch (error) {
        console.error('Fetch all documents error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error retrieving documents matrix.' 
        });
    }
};

/**
 * 🔍 READ: Fetch all documents for a specific employee
 */
const getDocumentsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;

        const documents = await Document.query()
            .where('employee_id', employee_id)
            .where('is_deleted', false)
            .orderBy('created_at', 'desc');

        return res.status(200).json({
            success: true,
            data: documents
        });
    } catch (error) {
        console.error('Fetch employee documents error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve employee documents.' 
        });
    }
};

/**
 * 🔍 READ: Fetch single document by ID
 */
const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.query()
            .findById(id)
            .where('is_deleted', false)
            .withGraphFetched('employee');

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document target entry not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: document
        });
    } catch (error) {
        console.error('Fetch document by ID error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error retrieving target document.' 
        });
    }
};

/**
 * ➕ CREATE: Insert Single or Multiple Document Entries
 */
const createDocument = async (req, res) => {
    try {
        const payload = req.body;

        // Support array payload for batch uploads or single object payload
        const recordsToInsert = Array.isArray(payload) ? payload : [payload];

        for (const item of recordsToInsert) {
            if (!item.employee_id || !item.label || !item.type || !item.file_link) {
                return res.status(400).json({
                    success: false,
                    message: 'Every record must contain employee_id, label, type, and file_link.'
                });
            }

            if (!['pdf', 'image'].includes(item.type.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file type. Allowed values: pdf, image'
                });
            }
        }

        // Bulk or single insert using Objection
        const insertedData = await Document.query().insert(
            recordsToInsert.map(item => ({
                ...item,
                type: item.type.toLowerCase()
            }))
        );

        return res.status(201).json({
            success: true,
            message: 'Document(s) created successfully.',
            data: insertedData
        });
    } catch (error) {
        console.error('Create document error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error creating document entry.' 
        });
    }
};

/**
 * 🔄 UPDATE: Modify Existing Document Fields
 */
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, type, file_link, employee_id } = req.body;

        const existingDocument = await Document.query()
            .findById(id)
            .where('is_deleted', false);

        if (!existingDocument) {
            return res.status(404).json({
                success: false,
                message: 'Document record not found.'
            });
        }

        if (type && !['pdf', 'image'].includes(type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Allowed values: pdf, image'
            });
        }

        const updatedDocument = await Document.query().patchAndFetchById(id, {
            ...(label && { label }),
            ...(type && { type: type.toLowerCase() }),
            ...(file_link && { file_link }),
            ...(employee_id && { employee_id })
        });

        return res.status(200).json({
            success: true,
            message: 'Document details updated successfully.',
            data: updatedDocument
        });
    } catch (error) {
        console.error('Update document error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error updating document details.' 
        });
    }
};

/**
 * 🔄 UPSERT: Intelligent Insert-or-Update Endpoint
 */
const upsertDocument = async (req, res) => {
    try {
        const { id, employee_id, label, type, file_link } = req.body;

        if (!employee_id || !label || !type || !file_link) {
            return res.status(400).json({
                success: false,
                message: 'employee_id, label, type, and file_link are required.'
            });
        }

        if (!['pdf', 'image'].includes(type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Allowed values: pdf, image'
            });
        }

        let document;

        if (id) {
            document = await Document.query().patchAndFetchById(id, {
                employee_id,
                label,
                type: type.toLowerCase(),
                file_link
            });

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'Document target record not found.'
                });
            }
        } else {
            document = await Document.query().insert({
                employee_id,
                label,
                type: type.toLowerCase(),
                file_link
            });
        }

        return res.status(200).json({
            success: true,
            message: id ? 'Document record updated.' : 'Document created successfully.',
            data: document
        });
    } catch (error) {
        console.error('Upsert document error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error processing document entry.' 
        });
    }
};

/**
 * ❌ DELETE: Soft-delete document record
 */
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedCount = await Document.query()
            .findById(id)
            .where('is_deleted', false)
            .patch({ is_deleted: true });

        if (!updatedCount) {
            return res.status(404).json({ 
                success: false, 
                message: 'Document record not found or already archived.' 
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Document removed successfully.'
        });
    } catch (error) {
        console.error('Delete document error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error archiving document entry.' 
        });
    }
};

module.exports = {
    getAllDocuments,
    getDocumentsByEmployee,
    getDocumentById,
    createDocument,
    updateDocument,
    upsertDocument,
    deleteDocument
};