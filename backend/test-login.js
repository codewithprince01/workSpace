require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src-new/models/User');
const bcrypt = require('bcrypt');
const constants = require('./src-new/config/constants');

async function testLogin() {
  console.log('--- LOGIN PERFORMANCE TEST ---');
  
  // 1. Connection
  console.time('DB Connection');
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log('Connecting to:', mongoUri.substring(0, 20) + '...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.timeEnd('DB Connection');
  } catch (err) {
    console.error('DB Connection Failed:', err);
    process.exit(1);
  }

  // 2. Find User
  const email = 'prinsai.britannica@gmail.com';
  console.log(`Looking for user: ${email}`);
  console.time('Find User');
  const user = await User.findOne({ email }).select('+password');
  console.timeEnd('Find User');

  if (user) {
    console.log(`User found: ${user.email}`);
    console.log('Updating password to Ab@123456 ...');
    user.password = 'Ab@123456';
    await user.save();
    console.log('Password updated successfully.');
    
    // Test match
    const isMatch = await user.comparePassword('Ab@123456');
    console.log('Verification match:', isMatch);
  }

  // 3. Compare Password
  const password = 'Ab@123456';
  console.log('Comparing password...');
  console.time('Bcrypt Compare');
  const isMatch = await user.comparePassword(password);
  console.timeEnd('Bcrypt Compare');

  console.log('Match Result:', isMatch);

  console.log('--- TEST COMPLETE ---');
  process.exit(0);
}

testLogin();
