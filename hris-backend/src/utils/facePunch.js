const FaceEnrollment = require('../database/models/attendance/FaceEnrollment');
const FaceLivenessSession = require('../database/models/attendance/FaceLivenessSession');
const Setting = require('../database/models/system/Setting');
const { getObjectBuffer, FACE_S3_BUCKET } = require('./storage');
const { compareFaces, getLivenessResults } = require('./rekognition');
const { LIVENESS_ROLE_ARN } = require('./awsCreds');
const { MAX_FILE_BYTES } = require('../middleware/uploadMiddleware');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Pull an image off a request — either a multipart `image` field or a base64
 * data URI in `req.body.image`. Returns `{ buffer, contentType, fileName }` or null.
 * Throws an Error with `.status = 400` on a malformed payload.
 */
function parseIncomingImage(req) {
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

const fail = (status, message) => ({ required: true, ok: false, status, message });

/**
 * Resolve the "live capture" to match against the enrolled face. Prefers a
 * completed Face Liveness session; falls back to a submitted photo.
 * @returns {{ buffer: Buffer, method: string, livenessConfidence: number|null, livenessRow: object|null } | { error: object }}
 */
async function resolveLiveCapture(req, employeeId) {
    const sessionId = String(req.body?.liveness_session_id || '').trim();

    if (sessionId) {
        const row = await FaceLivenessSession.query().findOne({ session_id: sessionId });
        if (!row || row.employee_id !== employeeId) {
            return { error: fail(401, 'That liveness session is not valid for you. Start a new check.') };
        }
        if (row.consumed_at) {
            return { error: fail(409, 'That liveness check was already used. Start a new one.') };
        }

        let results;
        try {
            results = await getLivenessResults(sessionId);
        } catch (err) {
            console.error('facePunch: GetFaceLivenessSessionResults failed', err.message);
            return { error: fail(502, 'Could not read the liveness result. Please try again.') };
        }

        if (!results.live) {
            await FaceLivenessSession.query()
                .patchAndFetchById(row.id, { status: 'failed', confidence: results.confidence });
            const pct = results.confidence != null ? ` (${results.confidence.toFixed(0)}%)` : '';
            return { error: fail(401, `Liveness check failed${pct}. Move to a well-lit area and try again.`) };
        }

        let buffer = results.referenceImage;
        if (!buffer && results.s3Object?.Bucket && results.s3Object?.Name) {
            try {
                buffer = await getObjectBuffer(results.s3Object.Name, { bucket: results.s3Object.Bucket });
            } catch (err) {
                console.error('facePunch: liveness ref image fetch failed', err.message);
            }
        }
        if (!buffer) return { error: fail(502, 'The liveness check returned no image. Please try again.') };

        return { buffer, method: 'liveness', livenessConfidence: results.confidence, livenessRow: row };
    }

    // ---- photo path (also the fallback when liveness can't run) ----
    let img;
    try {
        img = parseIncomingImage(req);
    } catch (err) {
        return { error: fail(err.status || 400, err.message) };
    }
    if (!img) {
        return { error: fail(422, 'Face verification is required to continue.') };
    }
    if (!ALLOWED_MIME.has(img.contentType)) {
        return { error: fail(400, 'Only JPEG, PNG or WebP images are accepted.') };
    }
    if (img.buffer.length > MAX_FILE_BYTES) {
        return { error: fail(400, `Image exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`) };
    }

    // Tag it as a fallback when liveness was the expected method, so HR can audit.
    const livenessExpected =
        !!LIVENESS_ROLE_ARN && (await Setting.getBool('face.liveness_enabled', false));
    return {
        buffer: img.buffer,
        method: livenessExpected ? 'photo_fallback' : 'photo',
        livenessConfidence: null,
        livenessRow: null,
    };
}

/**
 * Gate a clock-in / clock-out behind face verification.
 *
 * Resolves to one of:
 *   { required: false }                                   — flag off, or employee not enrolled
 *   { required: true, ok: true, similarity, method, livenessConfidence }
 *   { required: true, ok: false, status, message }        — caller responds with this
 *
 * @param {{ req: import('express').Request, employeeId: number }} args
 */
async function verifyFacePunch({ req, employeeId }) {
    const enabled = await Setting.getBool('face.clockin_enabled', false);
    if (!enabled) return { required: false };

    const enrollment = await FaceEnrollment.query().findOne({
        employee_id: employeeId,
        is_deleted: false,
        status: 'active',
    });
    // Not enrolled yet — let them through so HR can roll enrollment out gradually.
    if (!enrollment) return { required: false };

    if (!FACE_S3_BUCKET) {
        return fail(503, 'Face verification is not configured. Contact HR.');
    }

    const capture = await resolveLiveCapture(req, employeeId);
    if (capture.error) return capture.error;

    let reference;
    try {
        reference = await getObjectBuffer(enrollment.image_key, { bucket: FACE_S3_BUCKET });
    } catch (err) {
        console.error('facePunch: could not load reference image', err.message);
        return fail(502, 'Could not load your enrolled face. Contact HR.');
    }

    let result;
    try {
        result = await compareFaces(reference, capture.buffer);
    } catch (err) {
        console.error('facePunch: CompareFaces failed', err.message);
        return fail(502, 'Face verification service is unavailable. Try again shortly.');
    }

    if (!result.matched) {
        const detail =
            result.similarity != null ? `${result.similarity.toFixed(0)}% similarity` : 'no face found';
        if (capture.livenessRow) {
            await FaceLivenessSession.query()
                .patchAndFetchById(capture.livenessRow.id, { status: 'failed', confidence: capture.livenessConfidence });
        }
        return fail(401, `Face did not match (${detail}). Move to better lighting and try again.`);
    }

    if (capture.livenessRow) {
        await FaceLivenessSession.query().patchAndFetchById(capture.livenessRow.id, {
            status: 'passed',
            confidence: capture.livenessConfidence,
            consumed_at: new Date().toISOString(),
        });
    }

    return {
        required: true,
        ok: true,
        similarity: result.similarity,
        method: capture.method,
        livenessConfidence: capture.livenessConfidence,
    };
}

module.exports = { parseIncomingImage, verifyFacePunch };
