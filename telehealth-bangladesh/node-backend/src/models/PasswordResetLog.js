const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const PasswordResetLog = sequelize.define('PasswordResetLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  request_ip: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'requested', // 'requested', 'verified', 'completed', 'expired'
  }
}, {
  tableName: 'password_reset_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Define associations
PasswordResetLog.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(PasswordResetLog, { foreignKey: 'user_id' });

module.exports = PasswordResetLog;
