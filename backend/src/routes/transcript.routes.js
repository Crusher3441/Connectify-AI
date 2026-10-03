import { Router } from 'express';
import Transcript from '../models/transcript.model.js';
import ActionItem from '../models/actionItem.model.js';
import { requireAuth } from '../middleware/auth.middleware.js';
// ⚠️ CORRECTION (C9): both handlers are async and hit Mongo. Unwrapped, any
// DB error left the request hanging forever instead of returning a 500.
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// THE delivery endpoint — see the ordering lesson: the summary is generated
// AFTER every socket is gone, so a broadcast would reach zero clients. REST at
// next-landing is the delivery mechanism.
router.get('/me/:meetingCode', requireAuth, asyncHandler(async (req, res) => {
  const code = String(req.params.meetingCode || '');
  if (!/^[a-z0-9]{4,12}$/i.test(code)) {
    return res.status(400).json({ message: 'Invalid meeting code' });
  }
  const transcript = await Transcript.findOne({ meetingCode: code });
  if (!transcript) return res.status(404).json({ message: 'No summary for this meeting yet' });

  // Authorization: owner OR a named participant of the meeting. Anyone else
  // with a valid token gets 403 — a valid login is not a pass to all reports.
  const isOwner = transcript.owner === req.user.username;
  const wasParticipant = transcript.entries.some((e) => e.username === req.user.username);
  if (!isOwner && !wasParticipant) {
    return res.status(403).json({ message: 'Not your meeting' });
  }

  const actionItems = await ActionItem.find({ meetingCode: code }).sort({ createdAt: 1 });
  return res.json({ summary: transcript.summary, actionItems });
}));

export default router;