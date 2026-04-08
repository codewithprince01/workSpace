const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team'
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project'
  },
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
  type: {
    type: String,
    enum: ['task_assigned', 'task_updated', 'comment_added', 'mention', 'project_invite', 'team_invite'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  is_read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
