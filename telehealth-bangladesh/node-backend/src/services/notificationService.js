const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize Twilio client dynamically (handle errors if keys are placeholders)
let twilioClient = null;
const hasTwilioCreds = 
  process.env.TWILIO_ACCOUNT_SID && 
  process.env.TWILIO_ACCOUNT_SID !== 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' &&
  process.env.TWILIO_AUTH_TOKEN;

if (hasTwilioCreds) {
  try {
    // Avoid importing twilio if not configured or if it causes errors
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('[NotificationService] Twilio initialization failed: ', err.message);
  }
}

// Nodemailer transport initialization
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

/**
 * Sends a 6-digit OTP code to either email or phone.
 * If credentials are not fully configured in the environment, it gracefully logs the output.
 */
const sendOTP = async (recipient, otpCode) => {
  const isEmail = recipient.includes('@');
  
  // Huge developer console banner (MANDATORY for testing in local sandbox)
  console.log('\n======================================================');
  console.log(`🔑 SECURE OTP CHALLENGE DISPATCHED`);
  console.log(`   RECIPIENT: ${recipient}`);
  console.log(`   OTP CODE:  ${otpCode}`);
  console.log(`   EXPIRATION: 5 Minutes (300s)`);
  console.log('======================================================\n');

  if (isEmail) {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@swasthonirapod.com.bd',
      to: recipient,
      subject: 'Forgot Password OTP Verification - SwasthoNirapod',
      text: `Hello,\n\nWe received a request to recover your account password. Your secure 6-digit verification code is:\n\n👉 ${otpCode}\n\nThis OTP is valid for exactly 5 minutes. Do not share this code with anyone.\n\nIf you did not request this code, please ignore this email.\n\nBest regards,\nSwasthoNirapod Security Desk`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; rounded: 8px;">
          <h2 style="color: #0d9488; text-align: center;">SwasthoNirapod Telemedicine</h2>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
          <p>Hello,</p>
          <p>We received a password reset request for your account. Please enter the following 6-digit OTP code to verify your request:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a; border: 1px dashed #0d9488; padding: 10px 20px; border-radius: 6px; background-color: #f0fdfa;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 14px;"><strong>Note:</strong> This verification code is valid for exactly <strong>5 minutes</strong>. If you did not trigger this request, please secure your credentials immediately.</p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">SwasthoNirapod Security Desk, Dhaka, Bangladesh</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[NotificationService] SMTP email sent to ${recipient}`);
      return { success: true, method: 'email' };
    } catch (error) {
      console.warn(`[NotificationService] Nodemailer failed (or SMTP server offline): ${error.message}`);
      return { success: false, method: 'email', error: error.message };
    }
  } else {
    // SMS Flow
    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          body: `SwasthoNirapod security OTP is: ${otpCode}. Valid for 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: recipient
        });
        console.log(`[NotificationService] Twilio SMS successfully sent to ${recipient}`);
        return { success: true, method: 'sms' };
      } catch (error) {
        console.warn(`[NotificationService] Twilio SMS API failed: ${error.message}`);
        return { success: false, method: 'sms', error: error.message };
      }
    } else {
      console.log(`[NotificationService] Twilio SMS not configured. Code logged in terminal.`);
      return { success: true, method: 'sms-simulated' };
    }
  }
};

module.exports = {
  sendOTP
};
