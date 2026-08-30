const FaceEnrollment = require('../../../../database/models/attendance/FaceEnrollment');
const Employee = require('../../../../database/models/employee/Employee');
const { logActivity } = require('../../../../utils/activityLogger');
const {
    uploadBuffer,
    deleteObject,
    getPresignedUrl,
    FACE_S3_BUCKET,
    FACE_S3_KEY_PREFIX,
} = require('../../../../utils/storage');
const {
    detectSingleFace,
    ensureCollection,
    indexFace,
    deleteFace,
    REKOGNITION_COLLECTION_ID,
} = require('../../../../utils/rekognition');
const { MAX_FILE_BYTES } = require('../../../../middleware/uploadMiddleware');

/**
 * Add/refresh this employee's face in the 1:N kiosk collection. Best-effort:
 * enrollment must still succeed when the collection is unconfigured or AWS is
 * unreachable (the kiosk just won't recognize them until a later /kiosk/reindex).
 * @returns {Promise<string|null>} the new Rekognition FaceId, or null
 */
async function syncCollectionFace(buffer, employeeId, previousFaceId) {
    if (!REKOGNITION_COLLECTION_ID) return null;
    try {
        await ensureCollection();
        if (previousFaceId) await deleteFace(previousFaceId);
        const res = await indexFace(buffer, String(employeeId));
        return res?.faceId || null;
    } catch (err) {
        console.error('face collection sync failed for employee', employeeId, '-', err.message);
        return null;
    }
}

const actorId = (req) => (req.user?.id ? parseInt(req.user.id, 10) : null);

const FACE_BUCKET_OPTS = { bucket: FACE_S3_BUCKET, prefix: FACE_S3_KEY_PREFIX };
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Read the incoming image from either a multipart `image` field (webcam capture
 * or file upload) or a base64 data URI in `req.body.image`.
 */
function readIncomingImage(req) {
    if (req.file) {
        return {
            buffer: req.file.buffer,
            contentType: String(req.file.mimetype || '').toLowerCase(),
            fileName: req.file.originalname || 'face.jpg',
        };
    }
    const { image } = req.body || {};
    if (typeof image === 'string' && image.startsWith('data:')) {
        const m = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/s.exec(image);
        if (!m) {
            const err = new Error('Malformed image payload.');
            err.status = 400;
            throw err;
        }
        return {
            buffer: Buffer.from(m[2], 'base64'),
            contentType: (m[1] || 'image/jpeg').toLowerCase(),
            fileName: 'capture.jpg',
        };
    }
    return null;
}

/** Attach a short-lived presigned URL for the reference image. */
const withImageUrl = async (row) => {
    if (!row) return null;
    const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
    let image_url = null;
    try {
        image_url = await getPresignedUrl(json.image_key, { ...FACE_BUCKET_OPTS, expiresIn: 600 });
    } catch (err) {
        console.error('Face image presign failed:', err.message);
    }
    return { ...json, image_url };
};

/**
 * GET /face-enrollment/me — lightweight enrollment status for the authenticated
 * employee (drives the PWA's "face required" clock-in prompt). No admin permission.
 */
const getMyEnrollment = async (req, res) => {
    try {
        const employeeId = actorId(req);
        if (!employeeId) return res.status(401).json({ success: false, message: 'Unauthenticated request.' });

        const row = await FaceEnrollment.query()
            .findOne({ employee_id: employeeId, is_deleted: false })
            .select('status', 'consent_at', 'created_at', 'updated_at');

        return res.status(200).json({
            success: true,
            data: {
                enrolled: !!row && row.status === 'active',
                status: row ? row.status : null,
                enrolled_at: row ? row.updated_at || row.created_at : null,
            },
        });
    } catch (error) {
        console.error('getMyEnrollment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /face-enrollment/:employee_id — current enrollment for an employee (or null).
 */
const getEnrollment = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const row = await FaceEnrollment.query().findOne({ employee_id, is_deleted: false });
        return res.status(200).json({ success: true, data: row ? await withImageUrl(row) : null });
    } catch (error) {
        console.error('getEnrollment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /face-enrollment — enroll (or re-capture) an employee's reference face.
 * Body: employee_id, consent (true), image (multipart file or base64 data URI).
 */
const enrollFace = async (req, res) => {
    try {
        if (!FACE_S3_BUCKET) {
            return res.status(503).json({
                success: false,
                message: 'Face recognition storage is not configured (FACE_S3_BUCKET).',
            });
        }

        const employeeId = parseInt(req.body.employee_id, 10);
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'employee_id is required.' });
        }

        const consent = req.body.consent === true || req.body.consent === 'true';
        if (!consent) {
            return res.status(400).json({
                success: false,
                message: 'Employee consent is required to enroll a facial biometric.',
            });
        }

        const employee = await Employee.query().findById(employeeId).where('is_deleted', false);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        let img;
        try {
            img = readIncomingImage(req);
        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
        if (!img) return res.status(400).json({ success: false, message: 'An image is required.' });
        if (!ALLOWED_MIME.has(img.contentType)) {
            return res.status(400).json({ success: false, message: 'Only JPEG, PNG or WebP images are accepted.' });
        }
        if (img.buffer.length > MAX_FILE_BYTES) {
            return res.status(400).json({
                success: false,
                message: `Image exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`,
            });
        }

        // ---- Rekognition quality gate ----
        let detection;
        try {
            detection = await detectSingleFace(img.buffer);
        } catch (err) {
            console.error('Rekognition DetectFaces failed:', err);
            return res.status(502).json({
                success: false,
                message: 'Face detection service is unavailable. Please try again shortly.',
            });
        }
        if (!detection.ok) {
            return res.status(422).json({ success: false, message: detection.reason });
        }

        const key = await uploadBuffer({
            buffer: img.buffer,
            contentType: img.contentType,
            keySegments: ['faces', 'employee', employeeId],
            fileName: img.fileName,
            ...FACE_BUCKET_OPTS,
        });

        const quality = { boundingBox: detection.boundingBox, quality: detection.quality };
        const existing = await FaceEnrollment.query().findOne({ employee_id: employeeId, is_deleted: false });

        // 1:N kiosk collection — re-index the new photo (best-effort).
        const faceId = await syncCollectionFace(img.buffer, employeeId, existing?.rekognition_face_id);

        let row;
        if (existing) {
            row = await FaceEnrollment.query()
                .context({ user: { id: actorId(req) } })
                .patchAndFetchById(existing.id, {
                    image_key: key,
                    rekognition_face_id: faceId,
                    detect_confidence: detection.confidence,
                    quality,
                    status: 'active',
                    consent_at: new Date().toISOString(),
                });
            if (existing.image_key && existing.image_key !== key) {
                await deleteObject(existing.image_key, FACE_BUCKET_OPTS);
            }
        } else {
            row = await FaceEnrollment.query()
                .context({ user: { id: actorId(req) } })
                .insertAndFetch({
                    employee_id: employeeId,
                    image_key: key,
                    rekognition_face_id: faceId,
                    detect_confidence: detection.confidence,
                    quality,
                    status: 'active',
                    consent_at: new Date().toISOString(),
                });
        }

        await logActivity({
            employeeId,
            action: existing ? 'face.re_enrolled' : 'face.enrolled',
            category: 'profile',
            description: existing
                ? 'HR re-captured the facial biometric for clock-in'
                : 'HR enrolled a facial biometric for clock-in',
            metadata: { face_enrollment_uuid: row.uuid, detect_confidence: detection.confidence },
            req,
        });

        return res.status(existing ? 200 : 201).json({ success: true, data: await withImageUrl(row) });
    } catch (error) {
        console.error('enrollFace error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /face-enrollment/:employee_id — remove an employee's enrollment.
 */
const removeEnrollment = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const row = await FaceEnrollment.query().findOne({ employee_id, is_deleted: false });
        if (!row) {
            return res.status(404).json({ success: false, message: 'No active face enrollment found.' });
        }

        await FaceEnrollment.query()
            .context({ user: { id: actorId(req) } })
            .patchAndFetchById(row.id, { is_deleted: true, status: 'disabled' });

        await deleteObject(row.image_key, FACE_BUCKET_OPTS);
        if (row.rekognition_face_id) await deleteFace(row.rekognition_face_id);

        await logActivity({
            employeeId: parseInt(employee_id, 10),
            action: 'face.removed',
            category: 'profile',
            description: 'HR removed the facial biometric enrollment',
            metadata: { face_enrollment_uuid: row.uuid },
            req,
        });

        return res.status(200).json({ success: true, message: 'Face enrollment removed.' });
    } catch (error) {
        console.error('removeEnrollment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getMyEnrollment, getEnrollment, enrollFace, removeEnrollment };
