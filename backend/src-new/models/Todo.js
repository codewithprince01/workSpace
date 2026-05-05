const mongoose = require('mongoose');
const { Schema } = mongoose;

const todoSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assigned_to: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  due_date: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  labels: [{
    type: String,
    trim: true
  }],
  completed_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for Overdue calculation
todoSchema.virtual('is_overdue').get(function() {
  if (this.status === 'completed' || !this.due_date) return false;
  return new Date() > this.due_date;
});

// Virtual for days overdue
todoSchema.virtual('days_overdue').get(function() {
  if (this.status === 'completed' || !this.due_date) return 0;
  const diff = new Date() - this.due_date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
});

module.exports = mongoose.model('Todo', todoSchema);
