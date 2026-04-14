const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskDependencySchema = new Schema({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  related_task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  dependency_type: {
    type: String,
    enum: ['blocked_by'],
    default: 'blocked_by'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

taskDependencySchema.index({ task_id: 1, related_task_id: 1 }, { unique: true });

module.exports = mongoose.model('TaskDependency', taskDependencySchema);
