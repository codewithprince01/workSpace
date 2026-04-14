const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectInvitationSchema = new Schema({
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  inviter_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  expires_at: {
    type: Date,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// NOTE: `token` already has `unique: true` in field definition, so no extra index needed.
// Index for finding pending invites for a project
projectInvitationSchema.index({ project_id: 1, email: 1 });

// Automatically expire documents? optional, but maybe we want to keep history.
// If we wanted auto-deletion: projectInvitationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProjectInvitation', projectInvitationSchema);
