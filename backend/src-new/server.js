require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initializeSocket } = require('./sockets');

const DEFAULT_PORT = Number(process.env.PORT || 3000);

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

const listenWithFallback = (startPort, maxRetries = 10) =>
  new Promise((resolve, reject) => {
    const tryListen = (port, retriesLeft) => {
      const onError = (err) => {
        if (err && err.code === 'EADDRINUSE' && retriesLeft > 0) {
          console.warn(`Port ${port} is in use. Trying ${port + 1}...`);
          tryListen(port + 1, retriesLeft - 1);
          return;
        }
        reject(err);
      };

      server.once('error', onError);
      server.listen(port, () => {
        server.removeListener('error', onError);
        resolve(port);
      });
    };

    tryListen(startPort, maxRetries);
  });

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start listening with automatic fallback if port is busy
    const activePort = await listenWithFallback(DEFAULT_PORT, 20);

    console.log('');
    console.log('===============================================');
    console.log('   WORKLENZ BACKEND SERVER');
    console.log('===============================================');
    console.log(`Port: ${activePort}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health Check: http://localhost:${activePort}/health`);
    console.log(`API Base: http://localhost:${activePort}/api`);
    console.log('===============================================');
    console.log('');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  if (server.listening) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

startServer();
