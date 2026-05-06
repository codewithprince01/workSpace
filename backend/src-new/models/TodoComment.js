const mongoose = require('mongoose');
const { Schema } = mongoose;

const todoCommentSchema = new Schema({
  todo_id: {
    type: Schema.Types.ObjectId,
    ref: 'Todo',
    required: true,
    index: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('TodoComment', todoCommentSchema);
