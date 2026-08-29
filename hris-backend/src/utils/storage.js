require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/* ============================================================
 * AWS S3 object storage for employee documents.
 *
 * Local vs live are the SAME bucket, split by AWS_S3_KEY_PREFIX
 * ("local/…" on a dev machine, "live/…" in production) so the two
 * environments never collide. Point a dev box at its own bucket by
 * just changing AWS_S3_BUCKET instead.
 * ========================================================== */

const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const BUCKET = process.env.AWS_S3_BUCKET || '';
// Optional folder every object is nested under. Leave AWS_S3_KEY_PREFIX blank
// when local and live already use separate buckets (hris-local / hris-live).
const PREFIX = String(process.env.AWS_S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
const PRESIGN_EXPIRES = parseInt(process.env.AWS_S3_PRESIGN_EXPIRES, 10) || 3600;

let _client = null;

const client = () => {
    if (!BUCKET) {
        throw new Error('AWS_S3_BUCKET is not configured — check your .env.');
    }
    if (!_client) {
        _client = new S3Client({
            region: REGION,
            // Explicit keys when provided; otherwise fall back to the default
            // provider chain (IAM role on EC2/ECS, shared credentials file, …).
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

/** Filesystem-safe, length-capped version of an uploaded file name. */
const safeName = (name = 'file') =>
    (path.basename(String(name)).replace(/[^\w.\-]+/g, '_').slice(-120) || 'file');

/**
 * Build an object key (optionally under AWS_S3_KEY_PREFIX), e.g.
 *   documents/employee/42/9f2c1b…-nbi_clearance.pdf
 */
const buildKey = (segments = [], fileName = 'file') => {
    const clean = [PREFIX, ...segments]
        .map((s) => String(s).replace(/[^\w\-]+/g, ''))
        .filter(Boolean);
    return [...clean, `${crypto.randomUUID()}-${safeName(fileName)}`].join('/');
};

const isDataUri = (v) => typeof v === 'string' && v.startsWith('data:');
const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
/** A value we persisted as an S3 object key (not a legacy data URI, not a URL). */
const isStoredKey = (v) =>
    typeof v === 'string' && v.length > 0 && !isDataUri(v) && !isHttpUrl(v);

/**
 * Upload a buffer to S3 and return the stored object key.
 * @param {{ buffer: Buffer, contentType?: string, keySegments?: Array, fileName?: string }} opts
 */
async function uploadBuffer({ buffer, contentType, keySegments = [], fileName = 'file' }) {
    const Key = buildKey(keySegments, fileName);
    await client().send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
        }),
    );
    return Key;
}

/** Short-lived presigned GET URL for an object key. */
async function getPresignedUrl(key, { expiresIn = PRESIGN_EXPIRES, download = false, fileName } = {}) {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ...(download
            ? { ResponseContentDisposition: `attachment; filename="${safeName(fileName || key)}"` }
            : {}),
    });
    return getSignedUrl(client(), command, { expiresIn });
}

/** Best-effort delete — never throws (callers treat storage cleanup as non-critical). */
async function deleteObject(key) {
    if (!isStoredKey(key)) return;
    try {
        await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch (err) {
        console.error('S3 deleteObject failed for', key, '-', err.message);
    }
}

/**
 * Resolve a stored `file_link` into something a browser can open:
 *  - legacy base64 data URI → returned unchanged
 *  - S3 object key          → short-lived presigned GET URL
 *  - already an absolute URL → returned unchanged
 */
async function resolveFileUrl(fileLink, { fileName, download = false } = {}) {
    if (!fileLink) return null;
    if (isDataUri(fileLink) || isHttpUrl(fileLink)) return fileLink;
    try {
        return await getPresignedUrl(fileLink, { fileName, download });
    } catch (err) {
        console.error('Presign failed for', fileLink, '-', err.message);
        return null;
    }
}

module.exports = {
    S3_BUCKET: BUCKET,
    S3_KEY_PREFIX: PREFIX,
    isDataUri,
    isStoredKey,
    buildKey,
    uploadBuffer,
    getPresignedUrl,
    deleteObject,
    resolveFileUrl,
};
