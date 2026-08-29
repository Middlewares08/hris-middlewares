const express = require('express');
const router = express.Router();

const {
    getMyDocuments,
    getMyDocumentRequests,
    uploadMyDocument,
    updateMyDocument,
    deleteMyDocument,
    listEmployeeDocuments,
    adminCreateDocument,
    adminDeleteDocument,
    listAllDocumentRequests,
    createDocumentRequest,
    updateDocumentRequest,
    cancelDocumentRequest,
    deleteDocumentRequest,
} = require('../../module/admin/controller/employee/DocumentPortalController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { singleFile } = require('../../middleware/uploadMiddleware');

const VIEW = 'employee-documents:view';
const CREATE = 'employee-documents:create';
const EDIT = 'employee-documents:edit';
const DELETE = 'employee-documents:delete';

// ---- SELF-SERVICE (any authenticated employee) ----
// 🎯 The '/me...' and '/requests/me' paths are declared before the admin ':id' routes.
router.get('/me', verifyToken, getMyDocuments);
router.post('/me', verifyToken, singleFile('file'), uploadMyDocument);
router.put('/me/:id', verifyToken, singleFile('file'), updateMyDocument);
router.delete('/me/:id', verifyToken, deleteMyDocument);
router.get('/requests/me', verifyToken, getMyDocumentRequests);

// ---- ADMIN: document requests ----
router.get('/requests', verifyToken, requirePermission(VIEW), listAllDocumentRequests);
router.post('/requests', verifyToken, requirePermission(CREATE), createDocumentRequest);
router.put('/requests/:id', verifyToken, requirePermission(EDIT), updateDocumentRequest);
router.patch('/requests/:id/cancel', verifyToken, requirePermission(EDIT), cancelDocumentRequest);
router.delete('/requests/:id', verifyToken, requirePermission(DELETE), deleteDocumentRequest);

// ---- ADMIN: employee document library ----
router.get('/employee/:employee_id', verifyToken, requirePermission(VIEW), listEmployeeDocuments);
router.post('/', verifyToken, requirePermission(CREATE), singleFile('file'), adminCreateDocument);
router.delete('/:id', verifyToken, requirePermission(DELETE), adminDeleteDocument);

module.exports = router;
