const express = require('express');
const router = express.Router();

const {
    getMyDocuments,
    getMyDocumentRequests,
    createMyDocumentRequest,
    cancelMyDocumentRequest,
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
    declineDocumentRequest,
    deleteDocumentRequest,
} = require('../../module/admin/controller/employee/DocumentPortalController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');
const { singleFile } = require('../../middleware/uploadMiddleware');

const VIEW = 'employee-documents:view';
const CREATE = 'employee-documents:create';
const EDIT = 'employee-documents:edit';
const DELETE = 'employee-documents:delete';

// ---- SELF-SERVICE (employee PWA, gated by the 'My Documents' scope) ----
// 🎯 The '/me...' and '/requests/me' paths are declared before the admin ':id' routes.
const MY_VIEW = 'my-documents:view';
const MY_CREATE = 'my-documents:create';
router.get('/me', verifyToken, requirePermission(MY_VIEW), getMyDocuments);
router.post('/me', verifyToken, requirePermission(MY_CREATE), singleFile('file'), uploadMyDocument);
router.put('/me/:id', verifyToken, requirePermission(MY_CREATE), singleFile('file'), updateMyDocument);
router.delete('/me/:id', verifyToken, requirePermission(MY_CREATE), deleteMyDocument);
router.get('/requests/me', verifyToken, requirePermission(MY_VIEW), getMyDocumentRequests);
router.post('/requests/me', verifyToken, requirePermission(MY_CREATE), createMyDocumentRequest);
router.patch('/requests/me/:id/cancel', verifyToken, requirePermission(MY_CREATE), cancelMyDocumentRequest);

// ---- ADMIN: document requests ----
router.get('/requests', verifyToken, requirePermission(VIEW), listAllDocumentRequests);
router.post('/requests', verifyToken, requirePermission(CREATE), createDocumentRequest);
router.put('/requests/:id', verifyToken, requirePermission(EDIT), updateDocumentRequest);
router.patch('/requests/:id/cancel', verifyToken, requirePermission(EDIT), cancelDocumentRequest);
router.patch('/requests/:id/decline', verifyToken, requirePermission(EDIT), declineDocumentRequest);
router.delete('/requests/:id', verifyToken, requirePermission(DELETE), deleteDocumentRequest);

// ---- ADMIN: employee document library ----
router.get('/employee/:employee_id', verifyToken, requirePermission(VIEW), listEmployeeDocuments);
router.post('/', verifyToken, requirePermission(CREATE), singleFile('file'), adminCreateDocument);
router.delete('/:id', verifyToken, requirePermission(DELETE), adminDeleteDocument);

module.exports = router;
