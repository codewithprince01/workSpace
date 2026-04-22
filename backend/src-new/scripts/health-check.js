require('dotenv').config();
const mongoose = require('mongoose');
const cacheService = require('../services/cache.service');
const emailService = require('../services/email.service');
const storageService = require('../services/storage.service');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  title: "\x1b[1m\x1b[35m"
};

const log = (msg, status = null) => {
  let indicator = '';
  if (status === 'OK') indicator = `${colors.green}[OK]${colors.reset} `;
  if (status === 'FAIL') indicator = `${colors.red}[FAIL]${colors.reset} `;
  if (status === 'WARN') indicator = `${colors.yellow}[WARN]${colors.reset} `;
  console.log(`${indicator}${msg}`);
};

const runCheck = async () => {
  console.log(`\n${colors.title}═══ WORKLENZ SYSTEM HEALTH CHECK ═══${colors.reset}\n`);

  // 1. Database Check
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db';
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    log(`Database: Connected to ${mongoose.connection.host}`, 'OK');
  } catch (err) {
    log(`Database: Connection failed - ${err.message}`, 'FAIL');
  }

  // 2. Cache Check
  try {
    const testKey = 'health-test-' + Date.now();
    await cacheService.set(testKey, { ok: true }, 10);
    const val = await cacheService.get(testKey);
    if (val && val.ok) {
      log(`Cache: Service is active (${process.env.REDIS_URL ? 'Redis' : 'Memory Fallback'})`, 'OK');
    } else {
      log('Cache: Failed to retrieve test value', 'FAIL');
    }
  } catch (err) {
    log(`Cache: Service error - ${err.message}`, 'FAIL');
  }

  // 3. Storage Check
  try {
    const provider = process.env.STORAGE_PROVIDER || 'db';
    log(`Storage: Configured provider: ${provider}`, 'OK');
    if (provider !== 'db') {
      log('Storage: local/cloud providers are disabled. Set STORAGE_PROVIDER=db.', 'FAIL');
    }
  } catch (err) {
    log(`Storage: Config failed - ${err.message}`, 'FAIL');
  }

  // 4. Email Check
  try {
    const mailProvider = process.env.MAIL_PROVIDER || 'console';
    log(`Email: Configured provider: ${mailProvider}`, 'OK');
    if (mailProvider === 'smtp' && !process.env.SMTP_HOST) {
        log('Email: SMTP Host is missing in .env', 'FAIL');
    }
  } catch (err) {
    log(`Email: Config failed - ${err.message}`, 'FAIL');
  }

  console.log(`\n${colors.title}═════════════════════════════════════${colors.reset}\n`);
  
  // Cleanup
  await mongoose.disconnect();
  process.exit(0);
};

runCheck().catch(err => {
  console.error('Health Check encountered fatal error:', err);
  process.exit(1);
});
