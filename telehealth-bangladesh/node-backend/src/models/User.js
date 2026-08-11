const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Django-compatible PBKDF2 password hasher
const hashDjangoPassword = (password) => {
  const salt = crypto.randomBytes(12).toString('base64').replace(/\+/g, '.'); // clean salt
  const iterations = 260000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
};

// Django-compatible PBKDF2 password verifier
const verifyDjangoPassword = (password, djangoHash) => {
  try {
    const parts = djangoHash.split('$');
    if (parts[0] !== 'pbkdf2_sha256') {
      return false;
    }
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalHash = parts[3];
    const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64');
    return derived === originalHash;
  } catch (err) {
    return false;
  }
};

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'patient',
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nid: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bmdc_reg: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  is_staff: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  is_superuser: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
}, {
  tableName: 'api_user',
  timestamps: false, // Map exactly to Django without auto-creating createdAt/updatedAt columns
});

// Method to verify password validity using both bcrypt and pbkdf2
User.prototype.comparePassword = async function (password) {
  const currentHash = this.password;
  
  if (currentHash.startsWith('pbkdf2_sha256$')) {
    return verifyDjangoPassword(password, currentHash);
  }
  
  if (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$')) {
    return bcrypt.compare(password, currentHash);
  }
  
  return password === currentHash; // fallback for plain-text (seeding validation)
};

// Set password with compatible hashing format
User.prototype.setPassword = function (password) {
  this.password = hashDjangoPassword(password);
};

module.exports = User;
module.exports.hashDjangoPassword = hashDjangoPassword;
module.exports.verifyDjangoPassword = verifyDjangoPassword;
