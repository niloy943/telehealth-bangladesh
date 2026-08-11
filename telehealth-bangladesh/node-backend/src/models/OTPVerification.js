const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OTPVerification = sequelize.define('OTPVerification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  phone_or_email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  otp_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiry_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  retry_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
}, {
  tableName: 'otp_verifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Helper checking if OTP expired
OTPVerification.prototype.isExpired = function () {
  return new Date() > new Date(this.expiry_time);
};

module.exports = OTPVerification;
