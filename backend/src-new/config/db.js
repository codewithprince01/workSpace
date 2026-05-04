const mongoose = require('mongoose');

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 15000, // Give Atlas 15s during server selection
  connectTimeoutMS:         15000, // TCP connect timeout
  socketTimeoutMS:          60000, // Max wait for a response on an open socket
  heartbeatFrequencyMS:     10000, // Ping Atlas every 10s to keep idle connections alive
  family:                   4,     // Force IPv4 (avoids IPv6 slowness on Windows)
  maxPoolSize:              10,
  minPoolSize:              2,
  maxIdleTimeMS:            60000, // Keep idle connections for 60s before discarding
};

let reconnectTimer = null;

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db';

    console.log('🔗 Attempting to connect to MongoDB...');

    const conn = await mongoose.connect(mongoURI, MONGO_OPTIONS);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // ── Connection event handlers ────────────────────────────────────────────
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected — will attempt to reconnect in 5s…');
      // Schedule a reconnect attempt so the server self-heals without restart
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(async () => {
          reconnectTimer = null;
          try {
            await mongoose.connect(
              process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db',
              MONGO_OPTIONS
            );
            console.log('✅ MongoDB reconnected successfully');
          } catch (err) {
            console.error('❌ MongoDB reconnect failed:', err.message);
          }
        }, 5000);
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    // ────────────────────────────────────────────────────────────────────────

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    // If Atlas connection fails due to IP whitelist, try local MongoDB
    if (process.env.MONGO_URI && error.message.includes('whitelist')) {
      console.log('🔄 Atlas IP-whitelist issue. Trying local MongoDB...');
      try {
        const localURI = 'mongodb://localhost:27017/worklenz_db';
        const conn = await mongoose.connect(localURI, {
          ...MONGO_OPTIONS,
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ Local MongoDB Connected: ${conn.connection.host}`);
        return conn;
      } catch (localError) {
        console.error('❌ Local MongoDB also failed:', localError.message);
      }
    }

    console.error(
      'Connection URI:',
      process.env.MONGO_URI?.replace(/:[^:@]+@/, ':****@')
    );
    console.warn('⚠️  Continuing without database connection…');
    return null;
  }
};

module.exports = connectDB;
