// ─────────────────────────────────────────────────────────────────────────────
// Security validation — crash EARLY if critical secrets are missing / weak.
// It is safer for the app to refuse to start than to run with known-public keys.
// ─────────────────────────────────────────────────────────────────────────────

const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret || _jwtSecret.trim().length < 16) {
  throw new Error(
    '[FATAL] JWT_SECRET is missing or too short (minimum 16 characters). ' +
    'Set it in your .env file before starting the server.'
  );
}

const _sessionSecret = process.env.SESSION_SECRET;
if (!_sessionSecret || _sessionSecret.trim().length < 16) {
  throw new Error(
    '[FATAL] SESSION_SECRET is missing or too short (minimum 16 characters). ' +
    'Set it in your .env file before starting the server.'
  );
}

const _storageProvider = String(process.env.STORAGE_PROVIDER || 'db').trim().toLowerCase();
if (_storageProvider === 'local') {
  throw new Error(
    '[FATAL] STORAGE_PROVIDER=local is disabled. Use STORAGE_PROVIDER=db for database blob storage.'
  );
}
if (!['db'].includes(_storageProvider)) {
  throw new Error(
    `[FATAL] Unsupported STORAGE_PROVIDER "${_storageProvider}". Supported providers: db.`
  );
}

module.exports = {
  // Application
  APP_NAME: 'Worklenz',
  APP_VERSION: '1.4.16',

  // JWT — value validated above, never falls back to a public default
  JWT_SECRET: _jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',

  // Session — value validated above
  SESSION_NAME: process.env.SESSION_NAME || 'worklenz.sid',
  SESSION_SECRET: _sessionSecret,
  SESSION_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days

  // Password
  SALT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // File Upload
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'application/msword',
  ],

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // 100 requests per window
  AUTH_RATE_LIMIT_WINDOW: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10, // 10 requests per 15 mins (stricter)

  // Cache (Redis)
  REDIS_URL: process.env.REDIS_URL || null,
  CACHE_TTL: 60 * 15, // 15 minutes default

  // Task Status Colors
  TASK_STATUS_COLORS: {
    TODO: '#75c9c0',
    IN_PROGRESS: '#3b7ad4',
    DONE: '#70a6f3',
  },

  // Priority Levels
  PRIORITY_LEVELS: {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    URGENT: 3,
  },
  
  // Mail
  MAIL_PROVIDER: process.env.MAIL_PROVIDER || 'console', // console, smtp, ses
  MAIL_FROM: process.env.MAIL_FROM || 'Worklenz <noreply@worklenz.com>',
  
  // SMTP Config
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 2525,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // AWS SES Config
  SES_REGION: process.env.AWS_REGION || 'us-east-1',

  // Storage
  STORAGE_PROVIDER: _storageProvider,
};
