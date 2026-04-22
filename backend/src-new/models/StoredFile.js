const mongoose = require('mongoose');
const { Schema } = mongoose;

const storedFileSchema = new Schema(
  {
    file_key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    file_type: {
      type: String,
      required: true,
      trim: true,
    },
    file_data: {
      type: Buffer,
      required: true,
    },
    uploaded_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

storedFileSchema.index({ uploaded_by: 1 });
storedFileSchema.index({ created_at: -1 });

module.exports = mongoose.model('StoredFile', storedFileSchema);
