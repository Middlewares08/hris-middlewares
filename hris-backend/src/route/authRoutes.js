const express = require('express');
const router = express.Router();
const authController = require('../module/auth/auth.controller');
const {
    loginValidator,
    OTPValidator,
    resendValidator,
    forgotPasswordValidator,
    verifyResetOtpValidator,
    resetPasswordValidator,
} = require('../middleware/authValidator');
const { verifyToken } = require('../middleware/authMiddleware');


// Matches your frontend skipRefreshRoutes and refresh URL expectations perfectly
router.post('/login', loginValidator, authController.login);
router.post('/login/verify-otp', OTPValidator, authController.verifyOtp);
router.post('/login/resend-otp', resendValidator, authController.resendOtp);

// Forgot-password (SMS OTP) flow
router.post('/forgot-password', forgotPasswordValidator, authController.forgotPassword);
router.post('/forgot-password/verify-otp', verifyResetOtpValidator, authController.verifyResetOtp);
router.post('/reset-password', resetPasswordValidator, authController.resetPassword);

router.get('/refresh', authController.refresh);
router.get('/me', verifyToken, authController.getCurrentProfile);

// Employee self-service profile (own contact / address / emergency contact / preferred name)
router.get('/me/profile', verifyToken, authController.getProfile);
router.patch('/me/profile', verifyToken, authController.updateProfile);

// Employee preferences / user settings (notification opt-ins + channel)
router.get('/me/preferences', verifyToken, authController.getPreferences);
router.patch('/me/preferences', verifyToken, authController.updatePreferences);

// Employee self-service — statutory IDs + payroll bank account, and read-only employment history
router.get('/me/statutory', verifyToken, authController.getStatutory);
router.patch('/me/statutory', verifyToken, authController.updateStatutory);
router.get('/me/employment', verifyToken, authController.getEmploymentHistory);

module.exports = router;
