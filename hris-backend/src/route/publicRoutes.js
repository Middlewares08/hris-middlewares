const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { contactAdmin } = require('../module/public/contact.controller');
const { getInstallStatus, validateKey, completeInstall } = require('../module/public/install.controller');
const { getLicenseStatus, activateLicense } = require('../module/public/license.controller');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Unauthenticated endpoints — reachable before login from either frontend.
router.post(
    '/contact-admin',
    [
        body('name').trim().notEmpty().withMessage('Your name is required')
            .isLength({ max: 120 }).withMessage('Name is too long'),
        body('email').isEmail().withMessage('Enter a valid email').trim(),
        body('message').trim().notEmpty().withMessage('A message is required')
            .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10–2000 characters'),
        body('source').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
        validate,
    ],
    contactAdmin,
);

// First-visit install flow — see install.controller.js for the full gate chain.
router.get('/install/status', getInstallStatus);

router.post(
    '/install/validate-key',
    [body('productKey').trim().notEmpty().withMessage('Product key is required'), validate],
    validateKey,
);

router.post(
    '/install/complete',
    [
        body('productKey').trim().notEmpty().withMessage('Product key is required'),
        body('email').isEmail().withMessage('Enter a valid email').trim(),
        body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }),
        body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }),
        validate,
    ],
    completeInstall,
);

// Unauthenticated license check — both frontends gate entry on this before login.
router.get('/license/status', getLicenseStatus);

// Recovery path off the /license-expired screen — no employee context needed,
// so (unlike /install/complete) this works even on a deployment that already
// has accounts.
router.post(
    '/license/activate',
    [
        body('productKey').trim().notEmpty().withMessage('Product key is required'),
        body('email').isEmail().withMessage('Enter a valid email').trim(),
        validate,
    ],
    activateLicense,
);

module.exports = router;
