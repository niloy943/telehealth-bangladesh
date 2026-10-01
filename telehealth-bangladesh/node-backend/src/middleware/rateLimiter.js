const rateLimit = require('express-rate-limit');

// General API rate limiter (prevents request flooding)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again after 15 minutes.'
  }
});

// Strict rate limiter for requesting OTP (prevents SMS/Email spamming)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests. Please try again after 15 minutes.'
  }
});

// Rate limiter for verification attempts (prevents brute forcing the 6-digit OTP code)
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP checks per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts. Please wait 15 minutes before trying again.'
  }
});

// Rate limiter for login requests (prevents brute force logins)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Account lockout policy triggered. Please try again in 15 minutes.'
  }
});

module.exports = {
  apiLimiter,
  otpLimiter,
  verificationLimiter,
  loginLimiter
};
