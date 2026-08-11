const express = require('express');
const router = express.Router();

const {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getAuditLogs
} = require('../controllers/authController');

const {
  otpLimiter,
  verificationLimiter,
  loginLimiter
} = require('../middleware/rateLimiter');

const authenticateToken = require('../middleware/authMiddleware');

// 1. Sandbox accounts creation
router.post('/register', register);

// 2. Authentication route
router.post('/login', loginLimiter, login);

// 3. Forgot password requests (OTP generation & sending)
router.post('/forgot-password', otpLimiter, forgotPassword);

// 4. OTP code checking
router.post('/verify-otp', verificationLimiter, verifyOTP);

// 5. Password resetting (final stage)
router.post('/reset-password', resetPassword);

// 6. Administrative security logs tracking
router.get('/audit-logs', authenticateToken, getAuditLogs);

module.exports = router;
