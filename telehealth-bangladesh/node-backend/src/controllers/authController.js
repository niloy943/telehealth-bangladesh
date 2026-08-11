const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTPVerification = require('../models/OTPVerification');
const PasswordResetLog = require('../models/PasswordResetLog');
const { sendOTP } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const { generateToken, verifyToken } = require('../services/tokenService');
const { Op } = require('sequelize');

// Helper to check password complexity rules
const validatePasswordStrength = (pwd) => {
  const minLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
};

// 1. Local Registration (Sandbox testing helper)
const register = async (req, res) => {
  const { username, email, phone, password, first_name, last_name, role } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  try {
    const existing = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }, { phone }]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Username, email, or phone number already registered.' });
    }

    const hashed = User.prototype.setPassword ? User.hashDjangoPassword(password) : await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      phone,
      password: hashed,
      first_name: first_name || '',
      last_name: last_name || '',
      role: role || 'patient',
      is_active: true,
      is_staff: false,
      is_superuser: false
    });

    await logAction({
      userId: user.id,
      action: 'USER_REGISTER',
      details: `User registered successfully with role: ${user.role}`,
      ipAddress
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

// 2. Local Login (Authenticates credentials, logs actions, issues JWT)
const login = async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      await logAction({
        action: 'LOGIN_FAILURE',
        details: `Failed login attempt for username: ${username} (Account not found)`,
        ipAddress
      });
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      await logAction({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        details: `Failed login attempt for username: ${username} (Incorrect credentials)`,
        ipAddress
      });
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    const accessToken = generateToken(tokenPayload);

    await logAction({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      details: `Successful login. JWT token issued for username: ${username}`,
      ipAddress
    });

    return res.status(200).json({
      access: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

// 3. Forgot Password Request (Validation, OTP dispatch, Reset Log initiation)
const forgotPassword = async (req, res) => {
  const { email_or_phone } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!email_or_phone) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  try {
    // Check user account existence
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email_or_phone },
          { phone: email_or_phone }
        ]
      }
    });

    if (!user) {
      await logAction({
        action: 'PASSWORD_RESET_ATTEMPT_FAIL',
        details: `Password reset requested for non-existent identifier: ${email_or_phone}`,
        ipAddress
      });
      return res.status(404).json({ error: 'No account found with this email address or phone number.' });
    }

    // Generate secure 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
    const otpHash = await bcrypt.hash(otpCode, 8);

    // Save OTP verification to DB
    await OTPVerification.create({
      phone_or_email: email_or_phone,
      otp_hash: otpHash,
      expiry_time: expiryTime,
      retry_attempts: 0,
      is_used: false
    });

    // Save password reset log entry
    const resetLog = await PasswordResetLog.create({
      user_id: user.id,
      request_ip: ipAddress,
      user_agent: userAgent,
      status: 'requested'
    });

    // Send the OTP using notification service
    const dispatchResult = await sendOTP(email_or_phone, otpCode);

    await logAction({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      details: `OTP code generated and dispatched via ${dispatchResult.method || 'notification'}. Reset Log ID: ${resetLog.id}`,
      ipAddress
    });

    return res.status(200).json({
      message: 'A 6-digit verification OTP has been sent. Please verify within 5 minutes.',
      recipient: email_or_phone
    });
  } catch (error) {
    console.error('Forgot password flow error:', error);
    return res.status(500).json({ error: 'Failed to initiate forgot password workflow.' });
  }
};

// 4. OTP Verification (Validates code, manages attempts/expiration, issues temp claim token)
const verifyOTP = async (req, res) => {
  const { email_or_phone, otp } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!email_or_phone || !otp) {
    return res.status(400).json({ error: 'Email/Phone and OTP code are required.' });
  }

  try {
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email_or_phone },
          { phone: email_or_phone }
        ]
      }
    });

    const verification = await OTPVerification.findOne({
      where: {
        phone_or_email: email_or_phone,
        is_used: false
      },
      order: [['created_at', 'DESC']]
    });

    if (!verification) {
      return res.status(400).json({ error: 'No active OTP verification session found. Please request a code.' });
    }

    // Check brute force thresholds (Max 3 retries)
    if (verification.retry_attempts >= 3) {
      return res.status(400).json({ error: 'Too many incorrect attempts. This OTP has been blocked. Please request a new code.' });
    }

    // Check OTP expiration (5 mins)
    if (verification.isExpired()) {
      await logAction({
        userId: user ? user.id : null,
        action: 'OTP_EXPIRED',
        details: `Expired OTP entered for ${email_or_phone}. Expiry was at ${verification.expiry_time}`,
        ipAddress
      });
      return res.status(400).json({ error: 'This verification code has expired (5-minute limit). Please request a new OTP.' });
    }

    // Compare input OTP against bcrypt hash
    const isValid = await bcrypt.compare(otp, verification.otp_hash);
    if (!isValid) {
      // Increment attempt counter
      verification.retry_attempts += 1;
      await verification.save();

      const remaining = 3 - verification.retry_attempts;

      await logAction({
        userId: user ? user.id : null,
        action: 'OTP_INVALID_ATTEMPT',
        details: `Invalid OTP entry. Attempt #${verification.retry_attempts}. Remaining attempts: ${remaining}`,
        ipAddress
      });

      if (remaining <= 0) {
        return res.status(400).json({ error: 'Too many incorrect attempts. This OTP has been locked. Please request a new code.' });
      }

      return res.status(400).json({ error: `Incorrect verification code. You have ${remaining} attempts remaining.` });
    }

    // Correct OTP: Update Reset Logs to verified
    if (user) {
      await PasswordResetLog.update(
        { status: 'verified' },
        {
          where: {
            user_id: user.id,
            status: 'requested'
          }
        }
      );
    }

    // Generate secure temporary signature token proving user verified this phone/email
    // Token is valid for 10 minutes, protecting the reset endpoint from direct unauthorized hits
    const resetSessionToken = generateToken({
      email_or_phone,
      verified: true,
      purpose: 'password_reset'
    });

    await logAction({
      userId: user ? user.id : null,
      action: 'OTP_VERIFICATION_SUCCESS',
      details: `Successful OTP validation. Reset validation token issued.`,
      ipAddress
    });

    return res.status(200).json({
      message: 'Code verified successfully. Redirecting to reset password.',
      reset_token: resetSessionToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ error: 'Failed to process OTP verification.' });
  }
};

// 5. Password Reset Flow (Validates strength, hashes password, invalidates tokens, updates DB)
const resetPassword = async (req, res) => {
  const { reset_token, new_password, confirm_password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!reset_token || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  // Verify temporary reset session token
  const decoded = verifyToken(reset_token);
  if (!decoded || !decoded.verified || decoded.purpose !== 'password_reset') {
    return res.status(401).json({ error: 'Session expired or invalid. Please verify your OTP again.' });
  }

  const { email_or_phone } = decoded;

  // Validate complexity constraints
  if (!validatePasswordStrength(new_password)) {
    return res.status(400).json({
      error: 'Password does not meet safety policies. It must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a digit, and a special character.'
    });
  }

  try {
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email_or_phone },
          { phone: email_or_phone }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Associated user account not found.' });
    }

    // Update user password (using custom Django-compatible PBKDF2 hashing helper)
    user.setPassword(new_password);
    await user.save();

    // Mark active OTP as used
    await OTPVerification.update(
      { is_used: true },
      {
        where: {
          phone_or_email: email_or_phone,
          is_used: false
        }
      }
    );

    // Update password reset logs
    await PasswordResetLog.update(
      { status: 'completed' },
      {
        where: {
          user_id: user.id,
          status: { [Op.in]: ['requested', 'verified'] }
        }
      }
    );

    await logAction({
      userId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
      details: 'Password successfully reset and active OTP codes invalidated.',
      ipAddress
    });

    return res.status(200).json({
      message: 'Password successfully reset. You can now login with your new credentials.'
    });
  } catch (error) {
    console.error('Password reset finalization error:', error);
    return res.status(500).json({ error: 'Failed to finalize password reset.' });
  }
};

// 6. Fetch System Audit Logs (Admin access only)
const getAuditLogs = async (req, res) => {
  try {
    // Ensure requesting user has the admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator role required.' });
    }

    const logs = await AuditLog.findAll({
      order: [['timestamp', 'DESC']],
      include: [
        {
          model: User,
          attributes: ['username', 'role']
        }
      ]
    });

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch logs.' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getAuditLogs
};
