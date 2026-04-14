const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskAttachmentSchema = new Schema({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: false,
    default: null
  },
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
  file_name: {
    type: String,
    required: true
  },
  file_key: {
    type: String,
    required: true
  },
  file_size: {
    type: Number,
    required: true
  },
  file_type: {
    type: String,
    required: true
  },
  url: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

taskAttachmentSchema.index({ task_id: 1 });
taskAttachmentSchema.index({ project_id: 1 });
taskAttachmentSchema.index({ created_at: -1 });
taskAttachmentSchema.index({ project_id: 1, task_id: 1 });
taskAttachmentSchema.index({ project_id: 1, created_at: -1 });

module.exports = mongoose.model('TaskAttachment', taskAttachmentSchema);
