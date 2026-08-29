// src/middleware/uploadMiddleware.js
const multer = require('multer');

// Files are buffered in memory then streamed straight to S3 — nothing hits disk.
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

const ALLOWED_MIME = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        cb(new Error('Only PDF and image files are allowed.'));
    },
});

/**
 * Accept an optional single file on `field`, turning multer failures into clean
 * 400s. Non-multipart requests (legacy base64 JSON) pass straight through.
 */
const singleFile = (field = 'file') => (req, res, next) => {
    upload.single(field)(req, res, (err) => {
        if (!err) return next();
        const message =
            err.code === 'LIMIT_FILE_SIZE'
                ? `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`
                : err.message || 'File upload failed.';
        return res.status(400).json({ success: false, message });
    });
};

module.exports = { singleFile, MAX_FILE_BYTES, ALLOWED_MIME };
