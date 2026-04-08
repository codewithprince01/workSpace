module.exports = {
  // Application
  APP_NAME: 'Worklenz',
  APP_VERSION: '1.4.16',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: '30d',
  
  // Session
  SESSION_NAME: process.env.SESSION_NAME || 'worklenz.sid',
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret',
  SESSION_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Password
  SALT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // File Upload
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword'],
  
  // Rate Limiting (very high for development - reduce in production)
  RATE_LIMIT_WINDOW: 1 * 60 * 1000, // 1 minute
  RATE_LIMIT_MAX: 5000, // Very high for development
  
  // Task Status Colors
  TASK_STATUS_COLORS: {
    TODO: '#75c9c0',
    IN_PROGRESS: '#3b7ad4',
    DONE: '#70a6f3'
  },
  
  // Priority Levels
  PRIORITY_LEVELS: {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    URGENT: 3
  }
};
