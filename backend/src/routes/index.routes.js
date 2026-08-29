import { Router } from 'express';
import router from './users.routes';

const router = Router();

router.use('/v1/users', userRoutes);

export default router;