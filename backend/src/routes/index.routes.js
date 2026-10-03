import { Router } from 'express';
import userRoutes from './users.routes.js';
import { roomStore } from '../controllers/socket/roomStore.js';
import { config } from '../config.js'

const router = Router();

router.use('/v1/users', userRoutes);

// temporary debug route ( remove before deployment )
router.get('/debug/rooms', (_req, res) => {
  if (config.env === 'production') return res.status(404).json({ message: 'Not found' });
  return res.json(roomStore.debugSnapshot());
});

export default router;