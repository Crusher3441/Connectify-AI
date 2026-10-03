import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema(
  {
    meetingCode: { type: String, required: true, index: true },
    task: { type: String, required: true },
    assignedTo: { type: String, default: null },    // AI guesses; humans confirm (Phase 6)
    status: {
      type: String,
      enum: ['open', 'done', 'dropped'],
      default: 'open',
    },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('ActionItem', actionItemSchema);