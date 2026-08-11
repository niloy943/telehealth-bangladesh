const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const sequelize = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');
const { apiLimiter } = require('./middleware/rateLimiter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet()); // Protect HTTP headers
app.use(cors({
  origin: '*', // Allow all cross-origins for local telehealth integration
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // JSON parser

// Apply general API rate limiter
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Bind API routes
app.use('/api/auth', authRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err.stack);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Seed default users if the database is empty
const seedDefaultUsers = async () => {
  try {
    const count = await User.count();
    if (count === 0) {
      console.log('[Database] Empty user registry. Seeding default telehealth credentials...');

      const seedUsers = [
        {
          username: 'nasim_patient',
          email: 'nasim.patient@healnsight.com.bd',
          phone: '+8801700000001',
          password_hash: 'Demo@12345', // Hook will hash it automatic
          role: 'patient',
          first_name: 'Nasim',
          last_name: 'Ahmed'
        },
        {
          username: 'sarah_doctor',
          email: 'sarah.jenkins@healnsight.com.bd',
          phone: '+8801700000002',
          password_hash: 'Demo@12345',
          role: 'doctor',
          first_name: 'Dr. Sarah',
          last_name: 'Jenkins'
        },
        {
          username: 'admin',
          email: 'admin@healnsight.com.bd',
          phone: '+8801700000003',
          password_hash: 'Admin@12345',
          role: 'admin',
          first_name: 'System',
          last_name: 'Admin'
        }
      ];

      // Bulk create to trigger hooks
      for (const u of seedUsers) {
        await User.create(u);
      }
      console.log('[Database] Seeding complete! Credentials synced with project guide.');
    }
  } catch (error) {
    console.error('[Database Seed Error] Seeding failed:', error);
  }
};

// Connect to Database & Launch Server
const startServer = async () => {
  try {
    // Sync only our custom tables (creates them if they do not exist)
    const OTPVerification = require('./models/OTPVerification');
    const PasswordResetLog = require('./models/PasswordResetLog');
    const AuditLog = require('./models/AuditLog');

    await OTPVerification.sync();
    await PasswordResetLog.sync();
    await AuditLog.sync();
    console.log('[Database] Custom authentication tables synchronized successfully.');

    // Seed default telehealth profiles
    await seedDefaultUsers();

    app.listen(PORT, () => {
      console.log('\n======================================================');
      console.log(`🚀 HealNsightAuth Service Running on Port ${PORT}`);
      console.log(`   Health endpoint: http://localhost:${PORT}/health`);
      console.log(`   API prefix: http://localhost:${PORT}/api/auth`);
      console.log('======================================================\n');
    });
  } catch (error) {
    console.error('Failed to sync DB and launch server:', error);
    process.exit(1);
  }
};

startServer();
