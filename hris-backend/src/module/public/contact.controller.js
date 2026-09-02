const { sendMail } = require('../../utils/mailer');

const isProd = process.env.NODE_ENV === 'production';

// Where the landing/login "Contact an admin" form delivers. Falls back to the
// generic from-address, then a local placeholder.
const ADMIN_INBOX =
    process.env.ADMIN_CONTACT_EMAIL || process.env.MAIL_FROM || 'admin@hris.local';

// Naive in-memory throttle — enough to blunt casual abuse of an unauthenticated
// endpoint. Resets on process restart; swap for a shared store if it ever needs
// to hold across instances.
const HITS = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HITS = 3;

const isRateLimited = (key) => {
    const now = Date.now();
    const recent = (HITS.get(key) || []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    HITS.set(key, recent);
    return recent.length > MAX_HITS;
};

const clientIp = (req) =>
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

/**
 * POST /public/contact-admin
 * Unauthenticated. Lets someone who can't get into either app reach an
 * administrator. Body: { name, email, message, source? }
 */
const contactAdmin = async (req, res) => {
    try {
        const { name, email, message, source } = req.body;
        const ip = clientIp(req);

        if (isRateLimited(ip)) {
            return res.status(429).json({
                message: "You've already sent a few messages. Please try again later.",
            });
        }

        const subject = `[HRIS] Help request from ${name}${source ? ` (${source})` : ''}`;
        const text = [
            `Name:    ${name}`,
            `Email:   ${email}`,
            source ? `Source:  ${source}` : null,
            `IP:      ${ip}`,
            `Time:    ${new Date().toISOString()}`,
            '',
            '---',
            message,
        ]
            .filter(Boolean)
            .join('\n');

        await sendMail({
            to: ADMIN_INBOX,
            subject,
            text,
            replyTo: `${name} <${email}>`,
        });

        const payload = {
            success: true,
            message: 'Thanks — your message was sent to an administrator.',
        };
        // Outside production, hand the composed email back so the flow is testable
        // without a real mail gateway (mirrors the OTP `devCode` convention).
        if (!isProd) payload.devPreview = { to: ADMIN_INBOX, subject, text };

        return res.status(200).json(payload);
    } catch (error) {
        console.error('contactAdmin failed:', error);
        return res.status(502).json({
            message: 'Could not send your message right now. Please try again later.',
        });
    }
};

module.exports = { contactAdmin };
