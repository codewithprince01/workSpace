const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db';
    
    console.log('🔗 Attempting to connect to MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // If Atlas connection fails, try local MongoDB
    if (process.env.MONGO_URI && error.message.includes('whitelist')) {
      console.log('🔄 Atlas connection failed due to IP whitelist. Trying local MongoDB...');
      try {
        const localURI = 'mongodb://localhost:27017/worklenz_db';
        const conn = await mongoose.connect(localURI, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4
        });
        console.log(`✅ Local MongoDB Connected: ${conn.connection.host}`);
        return conn;
      } catch (localError) {
        console.error('❌ Local MongoDB also failed:', localError.message);
      }
    }
    
    console.error('Full error:', error);
    console.error('Connection URI:', process.env.MONGO_URI?.replace(/:[^:@]+@/, ':****@')); // Hide password
    console.error('\n💡 To fix Atlas connection:');
    console.error('   1. Go to MongoDB Atlas → Network Access');
    console.error('   2. Add your current IP to the whitelist');
    console.error('   3. Or use local MongoDB for development');
    
    // Don't exit, let the server run without DB for now
    console.warn('⚠️ Continuing without database connection...');
    return null;
  }
};

module.exports = connectDB;
