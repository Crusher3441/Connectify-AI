import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    meetingCode: { type: String, required: true, unique: true },
    // ⚠️ CORRECTION (H7): meetingOwner is the LOGIN identity (lowercased),
    // because Phase 6 queries `{ meetingOwner: req.user.username }`. The lobby
    // display name is kept separately for rendering.
    meetingOwner: { type: String, required: true },
    meetingOwnerDisplayName: { type: String, default: null },
    startedAt: { type: Date },
    endedAt: { type: Date },
    participants: [
      {
        username: String,        // login identity — matched by Phase 6 access rules
        displayName: String,     // optional, human-facing
        totalChecks: Number,     // verification windows the client went through
        verifiedChecks: Number,  // windows where the face matched
        percentage: Number,      // computed ONLY at finalization (5F)
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Attendance', attendanceSchema);