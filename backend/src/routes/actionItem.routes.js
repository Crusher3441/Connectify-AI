import { Router } from 'express';
import mongoose from 'mongoose';
import ActionItem from '../models/actionItem.model.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { accessibleMeetingCodes, canAccessMeeting } from '../services/access.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js'; // ⚠️ CORRECTION (C9)

const router = Router();
const STATUSES = ['open', 'done', 'dropped'];

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.query;

  // Enum-validate the optional filter BEFORE it reaches Mongo (R5).
  const filter = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` });
    }
    filter.status = status;
  }

  // Ownership via accessible codes. GUARD the empty case: Mongo's
  // `meetingCode: { $in: [] }` matches NOTHING (correct, but easy to
  // misread as a bug) — return early and consistently.
  const codes = await accessibleMeetingCodes(req.user.username);
  if (codes.length === 0) return res.json({ items: [], count: 0 });

  const items = await ActionItem.find({ meetingCode: { $in: codes }, ...filter })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return res.json({ items, count: items.length });
}));

// ⚠️ CORRECTION (C9): same asyncHandler treatment.
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid action item id' });
  }
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${STATUSES.join(', ')}` });
  }

  const item = await ActionItem.findById(id);
  if (!item) return res.status(404).json({ message: 'Action item not found' });

  // Same rule as reading: hosting or having participated grants the toggle.
  const allowed = await canAccessMeeting(req.user.username, item.meetingCode);
  if (!allowed) return res.status(403).json({ message: 'Not your meeting' });

  item.status = status;
  await item.save();
  return res.json(item); // the updated doc — the client updates state from it
}));

export default router;