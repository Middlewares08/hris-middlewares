const FaceLivenessSession = require('../../../../database/models/attendance/FaceLivenessSession');
const FaceEnrollment = require('../../../../database/models/attendance/FaceEnrollment');
const Setting = require('../../../../database/models/system/Setting');
const { createLivenessSession, REKOGNITION_REGION } = require('../../../../utils/rekognition');
const { assumeLivenessRole, LIVENESS_ROLE_ARN } = require('../../../../utils/awsCreds');
const { FACE_S3_BUCKET } = require('../../../../utils/storage');

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);

/**
 * POST /face-liveness/session — start a liveness challenge for the authenticated
 * employee and hand back the SessionId + short-lived AWS creds the Amplify
 * FaceLivenessDetector needs to stream the challenge.
 */
const startSession = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        if (!FACE_S3_BUCKET || !LIVENESS_ROLE_ARN) {
            return res.status(503).json({ success: false, message: 'Liveness verification is not configured.' });
        }
        const enabled = await Setting.getBool('face.liveness_enabled', false);
        if (!enabled) {
            return res.status(409).json({ success: false, message: 'Liveness verification is currently disabled.' });
        }

        const enrollment = await FaceEnrollment.query()
            .findOne({ employee_id: employeeId, is_deleted: false, status: 'active' });
        if (!enrollment) {
            return res.status(409).json({ success: false, message: 'You have no enrolled face on file. Contact HR.' });
        }

        let sessionId;
        try {
            sessionId = await createLivenessSession();
        } catch (err) {
            console.error('CreateFaceLivenessSession failed:', err);
            return res.status(502).json({ success: false, message: 'Could not start the liveness check. Try again shortly.' });
        }

        let credentials;
        try {
            credentials = await assumeLivenessRole(employeeId);
        } catch (err) {
            console.error('assumeLivenessRole failed:', err);
            return res.status(502).json({ success: false, message: 'Could not obtain a verification session. Contact IT.' });
        }

        await FaceLivenessSession.query().insert({
            session_id: sessionId,
            employee_id: employeeId,
            status: 'pending',
        });

        return res.status(201).json({
            success: true,
            data: { sessionId, region: REKOGNITION_REGION, credentials },
        });
    } catch (error) {
        console.error('startSession error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { startSession };
