const express = require('express');
const router = express.Router();
const authController = require('../module/auth/auth.controller');
const { loginValidator, OTPValidator } = require('../middleware/authValidator');
const { verifyToken } = require('../middleware/authMiddleware');


// Matches your frontend skipRefreshRoutes and refresh URL expectations perfectly
router.post('/login', loginValidator, authController.login);
router.post('/login/verify-otp', OTPValidator, authController.verifyOtp);
router.get('/refresh', authController.refresh);
router.get('/me', verifyToken, authController.getCurrentProfile);

module.exports = router;