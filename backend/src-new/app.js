const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const fs = require('fs');

const constants = require('./config/constants');
const errorMiddleware = require('./middlewares/error.middleware');

// Import routes
const routes = require('./routes');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// Compression
app.use(compression());

// HTTP request logging (async write stream – does NOT block event loop)
if (process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    // Async combined log for production
    const accessLogStream = fs.createWriteStream(
      path.join(__dirname, '../../request.log'),
      { flags: 'a' }
    );
    app.use(morgan('combined', { stream: accessLogStream }));
  } else {
    // Pretty console logging for development
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

// Rate limiting
const limiter = rateLimit({
  windowMs: constants.RATE_LIMIT_WINDOW,
  max: constants.RATE_LIMIT_MAX,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Session configuration
app.use(session({
  name: constants.SESSION_NAME,
  secret: process.env.SESSION_SECRET || 'dev-secret',
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
app.get('/csrf-token', (req, res) => {
  res.json({ token: req.session?.csrfToken || 'mock-csrf-token' });
});

// API Routes
app.use('/api', routes);
app.use('/secure', routes); // Legacy route support

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
