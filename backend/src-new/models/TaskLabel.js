const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskLabelSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Label name is required'],
    trim: true,
    maxlength: [50, 'Label name cannot exceed 50 characters']
  },
  team_id: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  color_code: {
    type: String,
    default: '#1890ff'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

taskLabelSchema.index({ team_id: 1 });
taskLabelSchema.index({ name: 1, team_id: 1 }, { unique: true });

module.exports = mongoose.model('TaskLabel', taskLabelSchema);
