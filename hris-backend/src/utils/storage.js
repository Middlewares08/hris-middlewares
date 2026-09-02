require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/* ============================================================
 * AWS S3 object storage.
 *
 * The document library uses AWS_S3_BUCKET. Other features can point at
 * their own bucket by passing `{ bucket, prefix }` to any function below
 * (see FACE_S3_BUCKET, used by the face-recognition module) — one client
 * is cached per region/bucket-agnostic config, the bucket is just a param.
 *
 * Local vs live are SEPARATE buckets, set per environment via .env.
 * ========================================================== */

const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const BUCKET = process.env.AWS_S3_BUCKET || '';
// Optional folder every object is nested under (blank when local/live use separate buckets).
const PREFIX = String(process.env.AWS_S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
const PRESIGN_EXPIRES = parseInt(process.env.AWS_S3_PRESIGN_EXPIRES, 10) || 3600;

// Dedicated bucket for facial-biometric reference images (face-recognition module).
const FACE_S3_BUCKET = process.env.FACE_S3_BUCKET || '';
const FACE_S3_KEY_PREFIX = String(process.env.FACE_S3_KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');

let _client = null;

const client = () => {
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

/** Resolve the effective bucket for a call, throwing a clear error when unset. */
const resolveBucket = (bucket) => {
    const b = bucket || BUCKET;
    if (!b) {
        throw new Error('No S3 bucket configured — check AWS_S3_BUCKET / FACE_S3_BUCKET in your .env.');
    }
    return b;
};

/** Filesystem-safe, length-capped version of an uploaded file name. */
const safeName = (name = 'file') =>
    (path.basename(String(name)).replace(/[^\w.\-]+/g, '_').slice(-120) || 'file');

/**
 * Build an object key (optionally under a prefix), e.g.
 *   documents/employee/42/9f2c1b…-nbi_clearance.pdf
 */
const buildKey = (segments = [], fileName = 'file', prefix = PREFIX) => {
    const clean = [prefix, ...segments]
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
 * @param {{ buffer: Buffer, contentType?: string, keySegments?: Array, fileName?: string, bucket?: string, prefix?: string }} opts
 */
async function uploadBuffer({ buffer, contentType, keySegments = [], fileName = 'file', bucket, prefix }) {
    const Bucket = resolveBucket(bucket);
    const Key = buildKey(keySegments, fileName, prefix ?? PREFIX);
    await client().send(
        new PutObjectCommand({
            Bucket,
            Key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
        }),
    );
    return Key;
}

/** Fetch an object's bytes as a Buffer (used for face verification). */
async function getObjectBuffer(key, { bucket } = {}) {
    const out = await client().send(
        new GetObjectCommand({ Bucket: resolveBucket(bucket), Key: key }),
    );
    return Buffer.from(await out.Body.transformToByteArray());
}

/** Short-lived presigned GET URL for an object key. */
async function getPresignedUrl(key, { expiresIn = PRESIGN_EXPIRES, download = false, fileName, bucket } = {}) {
    const command = new GetObjectCommand({
        Bucket: resolveBucket(bucket),
        Key: key,
        ...(download
            ? { ResponseContentDisposition: `attachment; filename="${safeName(fileName || key)}"` }
            : {}),
    });
    return getSignedUrl(client(), command, { expiresIn });
}

/** Best-effort delete — never throws (callers treat storage cleanup as non-critical). */
async function deleteObject(key, { bucket } = {}) {
    if (!isStoredKey(key)) return;
    try {
        await client().send(new DeleteObjectCommand({ Bucket: resolveBucket(bucket), Key: key }));
    } catch (err) {
        console.error('S3 deleteObject failed for', key, '-', err.message);
    }
}

/**
 * List every object key in a bucket (optionally under a prefix), following
 * pagination. Returns `[{ key, size, lastModified }]`.
 *
 * For the nightly storage reconciler only — never call this on a request path.
 */
async function listAllKeys({ bucket, prefix } = {}) {
    const Bucket = resolveBucket(bucket);
    const Prefix = (prefix ?? PREFIX) || undefined;
    const out = [];
    let ContinuationToken;
    do {
        // eslint-disable-next-line no-await-in-loop
        const page = await client().send(
            new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }),
        );
        for (const o of page.Contents || []) {
            out.push({ key: o.Key, size: o.Size, lastModified: o.LastModified });
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return out;
}

/** True if the object still exists. 404 → false; a real error is rethrown. */
async function objectExists(key, { bucket } = {}) {
    if (!isStoredKey(key)) return false;
    try {
        await client().send(new HeadObjectCommand({ Bucket: resolveBucket(bucket), Key: key }));
        return true;
    } catch (err) {
        const code = err.$metadata?.httpStatusCode;
        if (code === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey') return false;
        throw err;
    }
}

/**
 * Resolve a stored `file_link` into something a browser can open:
 *  - legacy base64 data URI → returned unchanged
 *  - S3 object key          → short-lived presigned GET URL
 *  - already an absolute URL → returned unchanged
 */
async function resolveFileUrl(fileLink, { fileName, download = false, bucket } = {}) {
    if (!fileLink) return null;
    if (isDataUri(fileLink) || isHttpUrl(fileLink)) return fileLink;
    try {
        return await getPresignedUrl(fileLink, { fileName, download, bucket });
    } catch (err) {
        console.error('Presign failed for', fileLink, '-', err.message);
        return null;
    }
}

module.exports = {
    S3_BUCKET: BUCKET,
    S3_KEY_PREFIX: PREFIX,
    FACE_S3_BUCKET,
    FACE_S3_KEY_PREFIX,
    isDataUri,
    isStoredKey,
    buildKey,
    uploadBuffer,
    getObjectBuffer,
    getPresignedUrl,
    deleteObject,
    listAllKeys,
    objectExists,
    resolveFileUrl,
};
