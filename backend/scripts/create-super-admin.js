/**
 * create-super-admin.js
 * Creates or updates a super admin account.
 * Usage: node scripts/create-super-admin.js
 */

const path = require('path');

// backend/.env (parent of scripts folder)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI;

if (!MONGO_URI) {
  console.error('\n❌  MONGO_URI not found in .env file.\n');
  process.exit(1);
}

// ─── Credentials ──────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL    = 'admin@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Admin@1234';
const SUPER_ADMIN_NAME     = 'Super Admin';
const SALT_ROUNDS          = 10;
// ──────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, default: 'user' },
  is_admin: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  setup_completed: { type: Boolean, default: true },
  last_team_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  super_admin_active_team: { type: mongoose.Schema.Types.ObjectId, default: null },
  super_admin_manage_mode: { type: Boolean, default: false },
}, { strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const teamSchema = new mongoose.Schema({
  name: String,
  owner_id: mongoose.Schema.Types.ObjectId,
  color_code: String,
  is_active: Boolean,
}, { strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const teamMemberSchema = new mongoose.Schema({
  team_id: mongoose.Schema.Types.ObjectId,
  user_id: mongoose.Schema.Types.ObjectId,
  role: String,
  is_active: Boolean,
  joined_at: Date,
}, { strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User       = mongoose.model('User', userSchema);
const Team       = mongoose.model('Team', teamSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

(async () => {
  try {
    console.log('\n🔌  Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('✅  Connected.\n');

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);

    let user = await User.findOne({ email: SUPER_ADMIN_EMAIL.toLowerCase() });

    if (user) {
      // Update existing
      await User.findByIdAndUpdate(user._id, {
        password: hashedPassword,
        role: 'super_admin',
        is_admin: true,
        is_active: true,
        setup_completed: true,
        name: SUPER_ADMIN_NAME,
      });
      user = await User.findById(user._id);
      console.log('♻️   Existing user updated to super_admin.');
    } else {
      // Create new
      user = await User.create({
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        is_admin: true,
        is_active: true,
        setup_completed: true,
      });
      console.log('🆕  New super admin user created.');
    }

    // Ensure personal team exists
    let team = await Team.findOne({ owner_id: user._id });
    if (!team) {
      team = await Team.create({
        name: "Super Admin's Team",
        owner_id: user._id,
        color_code: '#6366f1',
        is_active: true,
      });
      console.log('🏢  Personal team created.');
    }

    // Ensure team membership
    const membership = await TeamMember.findOne({ team_id: team._id, user_id: user._id });
    if (!membership) {
      await TeamMember.create({
        team_id: team._id,
        user_id: user._id,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
      });
      console.log('👥  Team membership created.');
    }

    // Set last_team_id
    await User.findByIdAndUpdate(user._id, { last_team_id: team._id });

    console.log('\n────────────────────────────────────────');
    console.log('👑  SUPER ADMIN ACCOUNT READY');
    console.log('────────────────────────────────────────');
    console.log(`    Email    : ${SUPER_ADMIN_EMAIL}`);
    console.log(`    Password : ${SUPER_ADMIN_PASSWORD}`);
    console.log(`    Role     : super_admin`);
    console.log(`    Team     : ${team.name}`);
    console.log('────────────────────────────────────────');
    console.log('\n✅  Login karein aur navbar mein 👑 crown button dekhein!\n');

  } catch (err) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
    console.log('🔌  Disconnected.\n');
  }
})();
