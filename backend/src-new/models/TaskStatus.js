const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskStatusSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Status name is required'],
    trim: true,
    maxlength: [50, 'Status name cannot exceed 50 characters']
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  color_code: {
    type: String,
    default: '#1890ff'
  },
  category: {
    type: String,
    enum: ['todo', 'doing', 'done'],
    default: 'todo'
  },
  sort_order: {
    type: Number,
    default: 0
  },
  is_default: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Indexes
taskStatusSchema.index({ project_id: 1, sort_order: 1 });

module.exports = mongoose.model('TaskStatus', taskStatusSchema);
