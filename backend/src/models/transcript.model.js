import mongoose from 'mongoose';

const transcriptSchema = new mongoose.Schema(
  {
    meetingCode: { type: String, required: true, unique: true },
    // ⚠️ CORRECTION (H7): owner = LOGIN identity (matched against
    // req.user.username); the lobby display name lives beside it.
    owner: { type: String, required: true },        // meeting owner's login username
    ownerDisplayName: { type: String, default: null },
    entries: [
      {
        username: String,       // login identity — Phase 6 access check
        displayName: String,    // what the panel renders
        text: String,
        at: Date,
      },
    ],
    summary: { type: mongoose.Schema.Types.Mixed }, // the AI payload — flexible by design
  },
  { timestamps: true }
);

export default mongoose.model('Transcript', transcriptSchema);