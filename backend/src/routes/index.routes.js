import { Router } from 'express';
import { config } from '../config.js';
import { roomStore } from '../controllers/socket/roomStore.js';
import userRoutes from './users.routes.js';
import transcriptRoutes from './transcript.routes.js';
import attendanceRoutes from './attendance.routes.js';
import actionItemRoutes from './actionItem.routes.js';

const router = Router();

// Feature routers mount here as phases add them:
router.use('/v1/users', userRoutes);
router.use('/v1/transcripts', transcriptRoutes);   // Phase 5 — authorized report read
router.use('/v1/attendance', attendanceRoutes);   // Phase 6 — hosted reports
router.use('/v1/action-items', actionItemRoutes); // Phase 6 — GET + PATCH

// TEMPORARY (dev only) — lets you watch rooms while building Phase 3/4.
// Delete before deployment.
router.get('/debug/rooms', (_req, res) => {
  if (config.env === 'production') return res.status(404).json({ message: 'Not found' });
  return res.json(roomStore.debugSnapshot());
});

export default router;