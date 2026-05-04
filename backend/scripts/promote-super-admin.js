/**
 * promote-super-admin.js
 * 
 * CLI utility to promote a user to super_admin role.
 * 
 * Usage (run from the backend/ directory):
 *   node scripts/promote-super-admin.js <email>
 * 
 * Example:
 *   node scripts/promote-super-admin.js admin@yourdomain.com
 */

const path = require('path');

// Load .env from src-new/ (where the app's .env lives)
require('dotenv').config({ path: path.join(__dirname, '../src-new/.env') });

const mongoose = require('mongoose');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  'mongodb://localhost:27017/worklenz_db';

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('\n❌  Usage: node scripts/promote-super-admin.js <email>\n');
  console.error('   Example: node scripts/promote-super-admin.js admin@example.com\n');
  process.exit(1);
}

// Minimal inline schema — avoids loading the full app
const userSchema = new mongoose.Schema(
  {
    email: String,
    name: String,
    role: { type: String, enum: ['user', 'super_admin'], default: 'user' },
    is_admin: Boolean,
  },
  { strict: false }
);
const User = mongoose.model('User', userSchema);

(async () => {
  try {
    const displayUri = MONGO_URI.replace(/:\/\/[^@]+@/, '://****@');
    console.log(`\n🔌  Connecting to: ${displayUri}`);
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅  Connected.\n');

    const user = await User.findOne({ email: userEmail.toLowerCase().trim() });

    if (!user) {
      // List all users to help identify the right email
      const allUsers = await User.find({}, 'name email role').lean();
      console.error(`❌  No user found with email: "${userEmail}"\n`);
      if (allUsers.length > 0) {
        console.log('📋  Available users:');
        allUsers.forEach(u => {
          console.log(`    [${u.role || 'user'}]  ${u.email}  (${u.name || 'No name'})`);
        });
      } else {
        console.log('   No users found in the database at all.');
      }
      console.log();
      await mongoose.disconnect();
      process.exit(1);
    }

    const prev = user.role || 'user';

    if (prev === 'super_admin') {
      console.log(`ℹ️   User "${user.email}" is already a super_admin. No changes made.\n`);
      await mongoose.disconnect();
      process.exit(0);
    }

    user.role = 'super_admin';
    user.is_admin = true;
    await user.save();

    console.log('✅  Successfully promoted:');
    console.log(`    Name  : ${user.name}`);
    console.log(`    Email : ${user.email}`);
    console.log(`    Role  : ${prev} → super_admin\n`);
    console.log('👑  Log in to see the crown button in the navbar.\n');
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
      console.error('    Could not reach MongoDB. Is the database running?');
      console.error(`    URI used: ${MONGO_URI}\n`);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    console.log('🔌  Disconnected.\n');
  }
})();
