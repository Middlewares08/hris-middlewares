const FaceEnrollment = require('../../../../database/models/attendance/FaceEnrollment');
const FaceLivenessSession = require('../../../../database/models/attendance/FaceLivenessSession');
const KioskDevice = require('../../../../database/models/attendance/KioskDevice');
const Employee = require('../../../../database/models/employee/Employee');
const Setting = require('../../../../database/models/system/Setting');
const { logActivity } = require('../../../../utils/activityLogger');
const { punchByEmployee } = require('../../../../utils/attendancePunch');
const { generateToken, hashToken } = require('../../../../utils/kioskAuth');
const {
    createLivenessSession,
    getLivenessResults,
    searchFaceByImage,
    ensureCollection,
    indexFace,
    REKOGNITION_COLLECTION_ID,
    REKOGNITION_REGION,
} = require('../../../../utils/rekognition');
const { assumeLivenessRole, LIVENESS_ROLE_ARN } = require('../../../../utils/awsCreds');
const {
    getObjectBuffer,
    getPresignedUrl,
    FACE_S3_BUCKET,
    FACE_S3_KEY_PREFIX,
} = require('../../../../utils/storage');

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);
const FACE_BUCKET_OPTS = { bucket: FACE_S3_BUCKET, prefix: FACE_S3_KEY_PREFIX };

const featureReady = () => !!(FACE_S3_BUCKET && LIVENESS_ROLE_ARN && REKOGNITION_COLLECTION_ID);

/* ============================================================
 * Device-token endpoints (verifyKioskToken) — the kiosk screen itself
 * ========================================================== */

/** GET /kiosk/config — the kiosk self-checks it can run before turning the camera on. */
const getConfig = async (req, res) => {
    try {
        const kioskEnabled = await Setting.getBool('face.kiosk_enabled', false);
        return res.status(200).json({
            success: true,
            data: {
                name: req.kiosk.name,
                kioskEnabled,
                ready: featureReady(),
                region: REKOGNITION_REGION,
            },
        });
    } catch (error) {
        console.error('kiosk getConfig error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** POST /kiosk/liveness-session — open a Rekognition liveness challenge for a walk-up. */
const startLiveness = async (req, res) => {
    try {
        if (!featureReady()) {
            return res.status(503).json({ success: false, message: 'The attendance kiosk is not configured.' });
        }
        if (!(await Setting.getBool('face.kiosk_enabled', false))) {
            return res.status(409).json({ success: false, message: 'The attendance kiosk is currently disabled.' });
        }

        let sessionId;
        try {
            sessionId = await createLivenessSession();
        } catch (err) {
            console.error('kiosk CreateFaceLivenessSession failed:', err);
            return res.status(502).json({ success: false, message: 'Could not start verification. Try again shortly.' });
        }

        let credentials;
        try {
            credentials = await assumeLivenessRole(`kiosk-${req.kiosk.id}`);
        } catch (err) {
            console.error('kiosk assumeLivenessRole failed:', err);
            return res.status(502).json({ success: false, message: 'Could not obtain a verification session. Contact IT.' });
        }

        await FaceLivenessSession.query().insert({
            session_id: sessionId,
            employee_id: null,
            kiosk_device_id: req.kiosk.id,
            status: 'pending',
        });

        return res.status(201).json({
            success: true,
            data: { sessionId, region: REKOGNITION_REGION, credentials },
        });
    } catch (error) {
        console.error('kiosk startLiveness error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const publicEmployee = async (employee, enrollment) => {
    let photo_url = null;
    if (enrollment?.image_key) {
        try {
            photo_url = await getPresignedUrl(enrollment.image_key, { ...FACE_BUCKET_OPTS, expiresIn: 300 });
        } catch (err) {
            console.error('kiosk photo presign failed:', err.message);
        }
    }
    return {
        id: employee.id,
        uuid: employee.uuid,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        position: employee.position?.name || null,
        department: employee.position?.department?.name || null,
        photo_url,
    };
};

/** POST /kiosk/punch — identify the liveness-verified person and clock them in/out. */
const punch = async (req, res) => {
    try {
        if (!featureReady()) {
            return res.status(503).json({ success: false, message: 'The attendance kiosk is not configured.' });
        }
        if (!(await Setting.getBool('face.kiosk_enabled', false))) {
            return res.status(409).json({ success: false, message: 'The attendance kiosk is currently disabled.' });
        }

        const sessionId = String(req.body?.liveness_session_id || '').trim();
        if (!sessionId) {
            return res.status(400).json({ success: false, code: 'NO_SESSION', message: 'A verification session is required.' });
        }

        const session = await FaceLivenessSession.query().findOne({ session_id: sessionId });
        if (!session || session.kiosk_device_id !== req.kiosk.id) {
            return res.status(401).json({ success: false, code: 'BAD_SESSION', message: 'That verification session is not valid for this kiosk.' });
        }
        if (session.consumed_at) {
            return res.status(409).json({ success: false, code: 'SESSION_USED', message: 'That verification was already used.' });
        }

        let results;
        try {
            results = await getLivenessResults(sessionId);
            // Results can lag the browser's onAnalysisComplete by a beat — retry
            // a couple of times while the session is still non-terminal.
            for (let i = 0; i < 3 && ['CREATED', 'IN_PROGRESS'].includes(results.status); i += 1) {
                await new Promise((r) => setTimeout(r, 700));
                results = await getLivenessResults(sessionId);
            }
        } catch (err) {
            console.error('kiosk GetFaceLivenessSessionResults failed:', err.message);
            return res.status(502).json({ success: false, code: 'LIVENESS_ERROR', message: 'Could not read the verification result.' });
        }

        console.log(
            `kiosk liveness result — session=${sessionId} status=${results.status} confidence=${results.confidence} live=${results.live}`,
        );

        if (!results.live) {
            await FaceLivenessSession.query().patchAndFetchById(session.id, {
                status: 'failed',
                confidence: results.confidence,
                consumed_at: new Date().toISOString(),
            });
            const pct = results.confidence != null ? ` (score ${results.confidence.toFixed(0)}%)` : '';
            return res.status(200).json({
                success: false,
                code: 'LIVENESS_FAILED',
                message: `Liveness check failed${pct}. Face the camera in good, even light and hold still.`,
                debug: { status: results.status, confidence: results.confidence },
            });
        }

        let frame = results.referenceImage;
        if (!frame && results.s3Object?.Bucket && results.s3Object?.Name) {
            try {
                frame = await getObjectBuffer(results.s3Object.Name, { bucket: results.s3Object.Bucket });
            } catch (err) {
                console.error('kiosk liveness ref image fetch failed:', err.message);
            }
        }
        if (!frame) {
            return res.status(502).json({ success: false, code: 'NO_FRAME', message: 'Verification returned no image. Try again.' });
        }

        let match;
        try {
            match = await searchFaceByImage(frame);
        } catch (err) {
            // "no face in the supplied image" / "collection is empty" come back as
            // InvalidParameterException — that's a non-match, not an outage.
            if (err.name === 'InvalidParameterException') {
                match = null;
            } else {
                console.error('kiosk SearchFacesByImage failed:', err.message);
                return res.status(502).json({ success: false, code: 'SEARCH_ERROR', message: 'Face search is unavailable. Try again shortly.' });
            }
        }

        const consume = (status) =>
            FaceLivenessSession.query().patchAndFetchById(session.id, {
                status,
                confidence: results.confidence,
                consumed_at: new Date().toISOString(),
            });

        if (!match) {
            await consume('passed');
            return res.status(200).json({
                success: false,
                code: 'NO_MATCH',
                message: 'We could not recognize you. Please see HR to enroll your face.',
            });
        }

        // Prefer the FaceId link; fall back to the ExternalImageId (employee id).
        let enrollment = await FaceEnrollment.query()
            .findOne({ rekognition_face_id: match.faceId, is_deleted: false, status: 'active' });
        if (!enrollment && match.externalImageId && /^\d+$/.test(match.externalImageId)) {
            enrollment = await FaceEnrollment.query()
                .findOne({ employee_id: parseInt(match.externalImageId, 10), is_deleted: false, status: 'active' });
        }
        if (!enrollment) {
            await consume('passed');
            return res.status(200).json({
                success: false,
                code: 'NO_MATCH',
                message: 'We could not match you to an active profile. Please see HR.',
            });
        }

        const employee = await Employee.query()
            .findById(enrollment.employee_id)
            .where('is_deleted', false)
            .withGraphFetched('position.department');
        if (!employee) {
            await consume('passed');
            return res.status(200).json({ success: false, code: 'NO_MATCH', message: 'Your employee profile is inactive. Please see HR.' });
        }

        const result = await punchByEmployee({
            employeeId: enrollment.employee_id,
            actorId: null,
            source: 'kiosk',
            faceMeta: {
                face_method: 'kiosk_liveness',
                face_similarity: match.similarity,
                liveness_confidence: results.confidence,
                kiosk_device_id: req.kiosk.id,
            },
            req,
        });

        await consume('passed');

        const person = await publicEmployee(employee, enrollment);

        if (!result.ok) {
            return res.status(200).json({
                success: true,
                data: {
                    employee: person,
                    action: 'none',
                    time: result.log?.time_out || result.log?.time_in || null,
                    message: "You're all set for today.",
                },
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                employee: person,
                action: result.action, // 'in' | 'out'
                time: result.action === 'out' ? result.log.time_out : result.log.time_in,
                worked_hours: result.action === 'out' ? result.log.worked_hours : null,
                message: result.action === 'out' ? 'Clocked out. See you tomorrow!' : 'Clocked in. Have a great day!',
            },
        });
    } catch (error) {
        console.error('kiosk punch error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/* ============================================================
 * Admin-JWT endpoints (verifyToken + requirePermission) — device management
 * ========================================================== */

/** GET /kiosk/devices */
const listDevices = async (req, res) => {
    try {
        const rows = await KioskDevice.query()
            .where('is_deleted', false)
            .orderBy('created_at', 'desc');
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('listDevices error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** POST /kiosk/devices — returns the raw token exactly once. */
const createDevice = async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ success: false, message: 'A device name is required.' });
        }
        const location = String(req.body?.location || '').trim() || null;

        const rawToken = generateToken();
        const row = await KioskDevice.query()
            .context({ user: { id: actorId(req) } })
            .insertAndFetch({
                name,
                location,
                token_hash: hashToken(rawToken),
                token_prefix: rawToken.slice(0, 8),
                status: 'active',
            });

        await logActivity({
            employeeId: actorId(req),
            action: 'kiosk.device_registered',
            category: 'system',
            description: `Registered attendance kiosk "${name}"`,
            metadata: { kiosk_device_uuid: row.uuid, location },
            req,
        });

        return res.status(201).json({ success: true, data: { ...row, token: rawToken } });
    } catch (error) {
        console.error('createDevice error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** DELETE /kiosk/devices/:uuid — revoke (soft) a device. */
const revokeDevice = async (req, res) => {
    try {
        const row = await KioskDevice.query().findOne({ uuid: req.params.uuid, is_deleted: false });
        if (!row) {
            return res.status(404).json({ success: false, message: 'Kiosk device not found.' });
        }
        await KioskDevice.query()
            .context({ user: { id: actorId(req) } })
            .patchAndFetchById(row.id, { status: 'revoked', is_deleted: true });

        await logActivity({
            employeeId: actorId(req),
            action: 'kiosk.device_revoked',
            category: 'system',
            description: `Revoked attendance kiosk "${row.name}"`,
            metadata: { kiosk_device_uuid: row.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Kiosk device revoked.' });
    } catch (error) {
        console.error('revokeDevice error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** POST /kiosk/reindex — index every active enrollment missing a Rekognition face id. */
const reindexEnrollments = async (req, res) => {
    try {
        if (!REKOGNITION_COLLECTION_ID || !FACE_S3_BUCKET) {
            return res.status(503).json({ success: false, message: 'Face collection is not configured (FACE_REKOGNITION_COLLECTION_ID / FACE_S3_BUCKET).' });
        }

        try {
            await ensureCollection();
        } catch (err) {
            console.error('ensureCollection failed:', err);
            return res.status(502).json({ success: false, message: 'Could not create/verify the face collection.' });
        }

        const rows = await FaceEnrollment.query()
            .where({ is_deleted: false, status: 'active' })
            .whereNull('rekognition_face_id');

        let indexed = 0;
        let failed = 0;
        for (const row of rows) {
            try {
                const buffer = await getObjectBuffer(row.image_key, { bucket: FACE_S3_BUCKET });
                const res2 = await indexFace(buffer, String(row.employee_id));
                if (res2?.faceId) {
                    await FaceEnrollment.query().patchAndFetchById(row.id, { rekognition_face_id: res2.faceId });
                    indexed += 1;
                } else {
                    failed += 1;
                }
            } catch (err) {
                console.error(`reindex employee ${row.employee_id} failed:`, err.message);
                failed += 1;
            }
        }

        await logActivity({
            employeeId: actorId(req),
            action: 'kiosk.faces_reindexed',
            category: 'system',
            description: `Re-indexed enrolled faces for the kiosk (${indexed} indexed, ${failed} failed)`,
            metadata: { indexed, failed, candidates: rows.length },
            req,
        });

        return res.status(200).json({ success: true, data: { indexed, failed, skipped: 0, candidates: rows.length } });
    } catch (error) {
        console.error('reindexEnrollments error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getConfig,
    startLiveness,
    punch,
    listDevices,
    createDevice,
    revokeDevice,
    reindexEnrollments,
};
