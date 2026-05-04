const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const constants = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [constants.MIN_PASSWORD_LENGTH, `Password must be at least ${constants.MIN_PASSWORD_LENGTH} characters`],
    select: false
  },
  avatar_url: {
    type: String,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'super_admin'],
    default: 'user'
  },
  is_admin: {
    type: Boolean,
    default: false
  },
  is_owner: {
    type: Boolean,
    default: false
  },
  // Super admin context: which org they are currently viewing
  super_admin_active_team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  super_admin_manage_mode: {
    type: Boolean,
    default: false
  },
  google_id: String,
  timezone: {
    type: String,
    default: 'UTC'
  },
  socket_id: String,
  last_login: Date,
  last_active_at: Date,
  login_count: {
    type: Number,
    default: 0
  },
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: Date,
  password_reset_token: String,
  password_reset_expires: Date,
  password_changed_at: Date,
  setup_completed: {
    type: Boolean,
    default: false
  },
  last_team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  popup_notifications_enabled: {
    type: Boolean,
    default: true
  },
  email_notifications_enabled: {
    type: Boolean,
    default: true
  },
  daily_digest_enabled: {
    type: Boolean,
    default: true
  },
  show_unread_items_count: {
    type: Boolean,
    default: true
  },
  // ── User Directory fields (set by super admin provisioning) ──────────────
  department: {
    type: String,
    default: ''
  },
  provisioned_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }

}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for faster queries
// NOTE: `email` already has `unique: true` in field definition, so no extra index needed.
userSchema.index({ google_id: 1 });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, constants.SALT_ROUNDS);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.password_reset_token;
  delete user.password_reset_expires;
  return user;
};

module.exports = mongoose.model('User', userSchema);
