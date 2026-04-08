// Fix for Windows DNS SRV resolution issues with MongoDB Atlas
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

const http = require('http');
const app = require('./src-new/app');
const connectDB = require('./src-new/config/db');
const { initializeSocket } = require('./src-new/sockets');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    server.listen(PORT, () => {
      console.log('');
      console.log('🚀 ═══════════════════════════════════════════════');
      console.log('   WORKLENZ BACKEND SERVER');
      console.log('═══════════════════════════════════════════════════');
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log('═══════════════════════════════════════════════════');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

startServer();
