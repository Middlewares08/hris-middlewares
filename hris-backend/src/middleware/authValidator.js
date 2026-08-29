// middlewares/validators.js
const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// NOTE: no `.normalizeEmail()` here. Employee creation stores the email verbatim
// (mixed case allowed), so normalising on read would lowercase/dot-strip the
// input and miss the row. Auth lookups are case-insensitive in the controller.
exports.loginValidator = [
    body("email").isEmail().withMessage("Enter a valid email").trim(),
    body("password").notEmpty().withMessage("Password is required"),
    validate
];

exports.OTPValidator = [
    body("email").isEmail().withMessage("Valid email is required").trim(),
    body("token").notEmpty().withMessage("Session token is required"),
    body("otp").notEmpty().withMessage("OTP is required"),
    validate
];

exports.resendValidator = [
    body("token").notEmpty().withMessage("Session token is required"),
    validate
];

exports.forgotPasswordValidator = [
    body("email").isEmail().withMessage("Enter a valid email").trim(),
    body("phone").notEmpty().withMessage("Mobile number is required"),
    validate
];

exports.verifyResetOtpValidator = [
    body("token").notEmpty().withMessage("Reset session token is required"),
    body("otp").notEmpty().withMessage("OTP is required"),
    validate
];

exports.resetPasswordValidator = [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    validate
];
