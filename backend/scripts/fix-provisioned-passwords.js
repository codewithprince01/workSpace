/**
 * One-time script: Reset password of all provisioned users to Britannica@1234
 * Run: node scripts/fix-provisioned-passwords.js
 *
 * These users had their password double-hashed due to a bug (manual bcrypt.hash
 * + User model pre-save hook both hashing). This script resets them to the
 * correct hash of the default password.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const MONGO_URI    = process.env.MONGO_URI || 'mongodb://localhost:27017/worklenz_db';
const DEFAULT_PASS = 'Britannica@1234';
const SALT_ROUNDS  = 10;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // All provisioned users (provisioned_by is set = created by super admin)
  const User = mongoose.model('User', new mongoose.Schema({
    email:          String,
    password:       { type: String, select: true },
    provisioned_by: mongoose.Schema.Types.ObjectId,
  }, { strict: false, collection: 'users' }));

  const users = await User.find({ provisioned_by: { $ne: null } }).select('+password');
  console.log(`Found ${users.length} provisioned user(s)`);

  if (!users.length) {
    console.log('Nothing to fix.');
    process.exit(0);
  }

  const newHash = await bcrypt.hash(DEFAULT_PASS, SALT_ROUNDS);

  let fixed = 0;
  for (const u of users) {
    // If the stored hash is a double-hash (bcrypt of a bcrypt string),
    // it will NOT match the plain-text password — reset it.
    const matches = await bcrypt.compare(DEFAULT_PASS, u.password);
    if (!matches) {
      await User.updateOne({ _id: u._id }, { $set: { password: newHash } });
      console.log(`  ✔ Fixed: ${u.email}`);
      fixed++;
    } else {
      console.log(`  ✓ OK (already correct): ${u.email}`);
    }
  }

  console.log(`\nDone — fixed ${fixed} / ${users.length} users`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
