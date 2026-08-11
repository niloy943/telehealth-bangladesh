const AuditLog = require('../models/AuditLog');

const logAction = async ({ userId = null, action, details, ipAddress }) => {
  try {
    const log = await AuditLog.create({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress || 'unknown'
    });
    console.log(`[AuditLog] [${action}] User ${userId || 'Guest'}: ${details} (IP: ${ipAddress})`);
    return log;
  } catch (error) {
    console.error('[AuditLog Error] Failed to write audit log:', error);
  }
};

module.exports = {
  logAction
};
