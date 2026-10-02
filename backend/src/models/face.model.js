import mongoose from 'mongoose';

const faceSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    meetingCode: { type: String, required: true },
    descriptor: { type: [Number], required: true }, // exactly 128, validated in the handler
  },
  { timestamps: true }
);

// One enrollment per person per meeting — re-enrollment REPLACES, never duplicates.
faceSchema.index({ username: 1, meetingCode: 1 }, { unique: true });

export default mongoose.model('Face', faceSchema);