const mongoose = require('mongoose');
const { Schema } = mongoose;

const taskPhaseSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Phase name is required'],
    trim: true
  },
  project_id: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  color_code: {
    type: String,
    default: '#cccccc'
  },
  sort_order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

taskPhaseSchema.index({ project_id: 1, sort_order: 1 });

module.exports = mongoose.model('TaskPhase', taskPhaseSchema);
