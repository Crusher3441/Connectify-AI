import { Router } from 'express';
import { registerUser, loginUser, getUserHistory, addMeetingToHistory } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public — the only two routes in the app that issue credentials
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected — the middleware mounts PER ROUTE, so "public by default, gated on purpose"
router.get('/me/history', requireAuth, getUserHistory);
router.post('/me/history', requireAuth, addMeetingToHistory);

export default router;
