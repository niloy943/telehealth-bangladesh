const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let sequelize;

if (process.env.DB_DIALECT === 'sqlite') {
  // Enforce configuration path directory creation
  const dbPath = path.resolve(__dirname, '..', '..', process.env.DB_SQLITE_PATH || './src/config/database.sqlite');
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false, // Set to console.log to debug query loops
  });
  console.log(`[Database] Connected to local SQLite: ${dbPath}`);
} else if (process.env.DB_DIALECT === 'postgres' || process.env.DATABASE_URL) {
  const options = {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };

  if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, options);
    console.log(`[Database] Connected to PostgreSQL via DATABASE_URL`);
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'telehealth_db',
      process.env.DB_USER || 'root',
      process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        ...options
      }
    );
    console.log(`[Database] Connecting to PostgreSQL at ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  }
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'telehealth_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
  console.log(`[Database] Connecting to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT}`);
}

module.exports = sequelize;
