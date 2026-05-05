const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('./utils/logger');

const constants = require('./config/constants');
const errorMiddleware = require('./middlewares/error.middleware');

// Import routes
const routes = require('./routes');
const requestIdMiddleware = require('./middlewares/requestId.middleware');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Request ID tracking
app.use(requestIdMiddleware);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Compression
app.use(compression());

// HTTP request logging
if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    const accessLogStream = fs.createWriteStream(
      path.join(__dirname, '../../request.log'),
      { flags: 'a' }
    );
    app.use(morgan('combined', { stream: accessLogStream }));
  } else {
    app.use(morgan('dev'));
  }
}

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== 'production') {
      // Development: allow all origins
      return callback(null, true);
    }

    // Production: enforce whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin '${origin}' not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'Accept',
    'X-Skip-Error-Alert',
    'x-skip-error-alert',
  ],
  exposedHeaders: ['Set-Cookie']
}));

// Rate limiting disabled (user requested)

// Session configuration
app.use(session({
  name: constants.SESSION_NAME,
  secret: constants.SESSION_SECRET, // validated at startup in constants.js — no fallback
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db',
    collectionName: 'sessions'
  }),
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: constants.SESSION_MAX_AGE
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine (if needed)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Swagger Specification
const swaggerSpec = require('./config/swagger');
app.get('/api-spec.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Worklenz Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// CSRF Token endpoint
// Generates (or reuses) a per-session crypto token. The frontend stores it in memory
// and sends it back in X-CSRF-Token header. We validate it on state-changing routes.
app.get('/csrf-token', (req, res) => {
  // If session doesn't have a CSRF token yet, generate one
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ token: req.session.csrfToken });
});

// CSRF validation middleware — applied to all state-changing API routes.
// Skipped for requests using Bearer token auth (JWT in Authorization header)
// because those are not vulnerable to CSRF (browser never auto-sends that header).
const csrfProtection = (req, res, next) => {
  // 1. Skip if safe method (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 2. Skip if request uses Bearer JWT auth (SPA with localStorage token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // For cookie-based sessions, validate the CSRF token
  const incoming = req.headers['x-csrf-token'] || req.headers['x-csrf-Token'];
  const expected = req.session?.csrfToken;
  if (!expected || !incoming || incoming !== expected) {
    logger.warn('CSRF validation failed for %s %s', req.method, req.originalUrl);
    return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
  }
  next();
};

// API Routes
app.use('/api/todos', (req, res, next) => {
  console.log(`[TodoAPI] Request: ${req.method} ${req.url}`);
  next();
});
app.use('/api', csrfProtection, routes);
app.use('/secure', csrfProtection, routes); // Legacy route support

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `DEBUG: Route ${req.method} ${req.originalUrl} not found in this app`
  });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
