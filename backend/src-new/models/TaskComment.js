const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskCommentSchema = new Schema({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
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
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

taskCommentSchema.index({ task_id: 1, created_at: -1 });

module.exports = mongoose.model('TaskComment', taskCommentSchema);
