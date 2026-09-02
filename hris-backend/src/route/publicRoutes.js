const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { contactAdmin } = require('../module/public/contact.controller');

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

module.exports = router;
