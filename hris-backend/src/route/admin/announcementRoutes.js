const express = require('express');
const router = express.Router();

const {
    getPublishedAnnouncements,
    getPublishedAnnouncementByUuid,
    getAllAnnouncements,
    getAnnouncementByUuid,
    createAnnouncement,
    updateAnnouncement,
    setAnnouncementStatus,
    deleteAnnouncement
} = require('../../module/admin/controller/announcement/AnnouncementController');

const { verifyToken } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// SELF-SERVICE — any authenticated employee, no admin permission required.
// 🎯 Declared before '/:uuid' so '/me' isn't swallowed as a uuid param.
router.get('/me', verifyToken, getPublishedAnnouncements);
router.get('/me/:uuid', verifyToken, getPublishedAnnouncementByUuid);

// ADMIN — gated by the 'Announcements' module permissions
router.get('/', verifyToken, requirePermission('announcements:view'), getAllAnnouncements);
router.get('/:uuid', verifyToken, requirePermission('announcements:view'), getAnnouncementByUuid);
router.post('/', verifyToken, requirePermission('announcements:create'), createAnnouncement);
router.put('/:uuid', verifyToken, requirePermission('announcements:edit'), updateAnnouncement);
router.patch('/:uuid/status', verifyToken, requirePermission('announcements:edit'), setAnnouncementStatus);
router.delete('/:uuid', verifyToken, requirePermission('announcements:delete'), deleteAnnouncement);

module.exports = router;
