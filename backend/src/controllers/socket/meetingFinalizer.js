import Attendance from '../../models/attendance.model.js';
import Transcript from '../../models/transcript.model.js';
import ActionItem from '../../models/actionItem.model.js';
import { summarizeTranscript } from '../../services/summarizer.js';

// Phase 5: saves attendance. Phase 5K extends this SAME function with the
// transcript + AI summary pipeline — that's why it lives in its own module.
export const finalizeMeeting = async (room) => {
  // ---- 1. ATTENDANCE (saves FIRST: a summary failure must never cost
  //         attendance data) ----
  const participants = [...room.attendance.entries()].map(([username, t]) => ({
    username,
    totalChecks: t.totalChecks,
    verifiedChecks: t.verifiedChecks,
    percentage: t.totalChecks ? Math.round((t.verifiedChecks / t.totalChecks) * 100) : 0,
  }));

  await Attendance.findOneAndUpdate(
    { meetingCode: room.code },
    {
      meetingCode: room.code,
      // ⚠️ CORRECTION (H7): meetingOwner is queried by Phase 6 as
      // `{ meetingOwner: req.user.username }` — it MUST be the login identity,
      // not the lobby display name.
      meetingOwner: room.ownerIdentity || 'unknown',
      meetingOwnerDisplayName: room.ownerUsername || 'unknown',
      startedAt: room.createdAt || new Date(),
      endedAt: new Date(),
      participants,
    },
    { upsert: true, returnDocument: 'after' } // was `new: true` (deprecated)
  );
  console.log(`[finalize] attendance saved for ${room.code} (${participants.length} tracked)`);

  // ---- 2. TRANSCRIPT + AI SUMMARY (5K) ----
  const entries = room.transcripts;
  if (entries.length >= 3) {
    // 3+ entries: skip summarizing "um, hello" meetings
    const rawText = entries.map((e) => `${e.username}: ${e.text}`).join('\n');
    const summary = await summarizeTranscript(rawText);

    // ⚠️ CORRECTION (H7): normalize entries before persisting so `username` is
    // the LOGIN identity (what Phase 6 authorizes against) and `displayName`
    // is what humans see. Phase 5K's read endpoint checks
    // `entries.some(e => e.username === req.user.username)`; storing the lobby
    // display name there 403'd legitimate participants on their own summary.
    const normalized = entries.map((e) => ({
      username: e.identity || String(e.username || '').toLowerCase(),
      displayName: e.username,
      text: e.text,
      at: e.at,
    }));

    await Transcript.findOneAndUpdate(
      { meetingCode: room.code },
      {
        meetingCode: room.code,
        owner: room.ownerIdentity || 'unknown',
        ownerDisplayName: room.ownerUsername || 'unknown',
        entries: normalized,
        summary,
      },
      { upsert: true }
    );

    if (summary.actionItems.length) {
      await ActionItem.insertMany(
        summary.actionItems.map((a) => ({
          meetingCode: room.code,
          task: a.task,
          assignedTo: a.assignedTo ?? null,
          status: 'open',
        }))
      );
    }
    console.log(`[finalize] summary saved for ${room.code} (source: ${summary.source})`);
  } else {
    console.log(`[finalize] ${room.code}: transcript too thin (${entries.length} entries) — no summary`);
  }
};