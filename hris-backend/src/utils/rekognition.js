require('dotenv').config();

// Lazy-loaded so the API can still boot before `npm i @aws-sdk/client-rekognition`
// has been run — the failure then surfaces only when a face endpoint is hit.
let _sdk = null;
const sdk = () => {
    if (!_sdk) _sdk = require('@aws-sdk/client-rekognition');
    return _sdk;
};

/* ============================================================
 * AWS Rekognition — facial biometrics for time & attendance.
 *
 *  - detectSingleFace(): quality gate run when HR enrolls a reference photo.
 *  - compareFaces():      1:1 verification, used at clock-in (next step) to
 *                         check the live capture against the stored reference.
 *
 * The employee is already authenticated at clock-in, so we never need 1:N
 * face search — CompareFaces against that one reference is enough and there
 * is no Face Collection to manage.
 * ========================================================== */

const REGION =
    process.env.FACE_REKOGNITION_REGION || process.env.AWS_REGION || 'us-east-1';
const MIN_DETECT_CONFIDENCE = parseFloat(process.env.FACE_MIN_DETECT_CONFIDENCE) || 90;
const MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 90;
const LIVENESS_THRESHOLD = parseFloat(process.env.FACE_LIVENESS_THRESHOLD) || 80;
// 1:N face search — the attendance kiosk indexes every enrolled face here so it
// can identify an unknown walk-up. Blank ⇒ the kiosk feature is disabled.
const COLLECTION_ID = process.env.FACE_REKOGNITION_COLLECTION_ID || '';

let _client = null;

const client = () => {
    if (!_client) {
        const { RekognitionClient } = sdk();
        _client = new RekognitionClient({
            region: REGION,
            credentials:
                process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                    ? {
                          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                      }
                    : undefined,
        });
    }
    return _client;
};

/**
 * Validate an enrollment photo: exactly one clearly-visible face.
 * @param {Buffer} buffer  raw image bytes (JPEG/PNG)
 * @returns {Promise<{ ok: boolean, reason?: string, confidence?: number, boundingBox?: object, quality?: object }>}
 */
async function detectSingleFace(buffer) {
    const { DetectFacesCommand } = sdk();
    const out = await client().send(
        new DetectFacesCommand({ Image: { Bytes: buffer }, Attributes: ['DEFAULT'] }),
    );
    const faces = out.FaceDetails || [];

    if (faces.length === 0) {
        return { ok: false, reason: 'No face detected. Use a clear, front-facing photo.' };
    }
    if (faces.length > 1) {
        return {
            ok: false,
            reason: `${faces.length} faces detected — the photo must contain exactly one person.`,
        };
    }

    const face = faces[0];
    const confidence = face.Confidence || 0;
    if (confidence < MIN_DETECT_CONFIDENCE) {
        return {
            ok: false,
            reason: `Face confidence ${confidence.toFixed(1)}% is below the ${MIN_DETECT_CONFIDENCE}% minimum — improve lighting and framing.`,
        };
    }
    if (face.Quality && typeof face.Quality.Sharpness === 'number' && face.Quality.Sharpness < 15) {
        return { ok: false, reason: 'The image is too blurry — hold steady and retake.' };
    }

    return {
        ok: true,
        confidence,
        boundingBox: face.BoundingBox || null,
        quality: face.Quality || null,
    };
}

/**
 * 1:1 face verification.
 * @param {Buffer} sourceBuffer  the enrolled reference image
 * @param {Buffer} targetBuffer  the live capture to verify
 * @returns {Promise<{ matched: boolean, similarity: number|null, threshold: number }>}
 */
async function compareFaces(sourceBuffer, targetBuffer) {
    const { CompareFacesCommand } = sdk();
    const out = await client().send(
        new CompareFacesCommand({
            SourceImage: { Bytes: sourceBuffer },
            TargetImage: { Bytes: targetBuffer },
            SimilarityThreshold: MATCH_THRESHOLD,
            QualityFilter: 'AUTO',
        }),
    );

    const best = (out.FaceMatches || [])
        .slice()
        .sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))[0];

    return {
        matched: !!best,
        similarity: best ? best.Similarity : (out.UnmatchedFaces?.length ? 0 : null),
        threshold: MATCH_THRESHOLD,
    };
}

/* ============================================================
 * Face Liveness — active anti-spoofing challenge.
 * The browser (Amplify FaceLivenessDetector) streams the challenge straight to
 * AWS; the backend only opens the session and reads the verdict afterwards.
 * ========================================================== */

/** Open a liveness session. Returns the SessionId the client needs. */
async function createLivenessSession() {
    const { CreateFaceLivenessSessionCommand } = sdk();
    const out = await client().send(new CreateFaceLivenessSessionCommand({}));
    return out.SessionId;
}

/**
 * Read a finished liveness session.
 * @returns {Promise<{ status: string, confidence: number|null, live: boolean, referenceImage: Buffer|null }>}
 */
async function getLivenessResults(sessionId) {
    const { GetFaceLivenessSessionResultsCommand } = sdk();
    const out = await client().send(
        new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
    );

    const status = out.Status || 'UNKNOWN';
    const confidence = typeof out.Confidence === 'number' ? out.Confidence : null;

    let referenceImage = null;
    const ref = out.ReferenceImage;
    if (ref?.Bytes) {
        referenceImage = Buffer.from(ref.Bytes);
    }

    return {
        status,
        confidence,
        live: status === 'SUCCEEDED' && confidence != null && confidence >= LIVENESS_THRESHOLD,
        referenceImage,
        s3Object: ref?.S3Object || null,
    };
}

/* ============================================================
 * Face Collection — 1:N identification for the attendance kiosk.
 *
 * Every active enrollment's reference image is indexed into ONE collection
 * (FACE_REKOGNITION_COLLECTION_ID) with ExternalImageId = employee id. The
 * kiosk then runs SearchFacesByImage on a liveness-verified frame to identify
 * whoever stepped up. The self-service PWA flow never touches this.
 * ========================================================== */

/** Create the collection if it doesn't exist yet. Safe to call repeatedly. */
async function ensureCollection() {
    if (!COLLECTION_ID) throw new Error('FACE_REKOGNITION_COLLECTION_ID is not configured.');
    const { CreateCollectionCommand } = sdk();
    try {
        await client().send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
    } catch (err) {
        if (err.name !== 'ResourceAlreadyExistsException') throw err;
    }
}

/**
 * Index one face into the collection.
 * @param {Buffer} buffer            reference image bytes
 * @param {string} externalImageId   employee id as a string (alphanumeric / :_-. only)
 * @returns {Promise<{ faceId: string } | null>}  null when no indexable face was found
 */
async function indexFace(buffer, externalImageId) {
    const { IndexFacesCommand } = sdk();
    const out = await client().send(
        new IndexFacesCommand({
            CollectionId: COLLECTION_ID,
            Image: { Bytes: buffer },
            ExternalImageId: String(externalImageId),
            MaxFaces: 1,
            QualityFilter: 'AUTO',
            DetectionAttributes: [],
        }),
    );
    const rec = (out.FaceRecords || [])[0];
    return rec?.Face?.FaceId ? { faceId: rec.Face.FaceId } : null;
}

/** Best-effort removal of an indexed face. Never throws. */
async function deleteFace(faceId) {
    if (!faceId || !COLLECTION_ID) return;
    try {
        const { DeleteFacesCommand } = sdk();
        await client().send(
            new DeleteFacesCommand({ CollectionId: COLLECTION_ID, FaceIds: [faceId] }),
        );
    } catch (err) {
        console.error('Rekognition DeleteFaces failed for', faceId, '-', err.message);
    }
}

/**
 * 1:N search — who is this?
 * @param {Buffer} buffer  a (liveness-verified) frame
 * @returns {Promise<{ faceId: string, externalImageId: string|null, similarity: number } | null>}
 */
async function searchFaceByImage(buffer) {
    const { SearchFacesByImageCommand } = sdk();
    const out = await client().send(
        new SearchFacesByImageCommand({
            CollectionId: COLLECTION_ID,
            Image: { Bytes: buffer },
            FaceMatchThreshold: MATCH_THRESHOLD,
            MaxFaces: 1,
        }),
    );
    const best = (out.FaceMatches || [])
        .slice()
        .sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))[0];
    if (!best?.Face?.FaceId) return null;
    return {
        faceId: best.Face.FaceId,
        externalImageId: best.Face.ExternalImageId || null,
        similarity: best.Similarity ?? null,
    };
}

module.exports = {
    detectSingleFace,
    compareFaces,
    createLivenessSession,
    getLivenessResults,
    ensureCollection,
    indexFace,
    deleteFace,
    searchFaceByImage,
    MIN_DETECT_CONFIDENCE,
    MATCH_THRESHOLD,
    LIVENESS_THRESHOLD,
    REKOGNITION_COLLECTION_ID: COLLECTION_ID,
    REKOGNITION_REGION: REGION,
};
