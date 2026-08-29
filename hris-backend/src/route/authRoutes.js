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

module.exports = router;
