const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectCommentSchema = new Schema({
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required']
  },
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [{
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    read_at: { type: Date, default: Date.now }
  }],
  is_edited: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

projectCommentSchema.index({ project_id: 1, created_at: 1 });

module.exports = mongoose.model('ProjectComment', projectCommentSchema);
