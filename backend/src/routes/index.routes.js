import { Router } from 'express';
import userRoutes from './users.routes.js';

const router = Router();

router.use('/v1/users', userRoutes);

export default router;