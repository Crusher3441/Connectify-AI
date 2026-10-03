import { Router } from 'express';
import Attendance from '../models/attendance.model.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js'; // ⚠️ CORRECTION (C9)

const router = Router();

// Reports for meetings YOU HOSTED. (Participant-only views are a noted
// extension — the analytics page computes personal stats client-side from
// hosted data in this phase.)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const items = await Attendance.find({ meetingOwner: req.user.username })
    .sort({ endedAt: -1 })
    .limit(50)
    .lean();
  return res.json({ items, count: items.length });
}));

export default router;