const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'timestamp',
  updatedAt: false
});

// Define associations
AuditLog.belongsTo(User, { foreignKey: 'user_id', onDelete: 'SET NULL' });
User.hasMany(AuditLog, { foreignKey: 'user_id' });

module.exports = AuditLog;
