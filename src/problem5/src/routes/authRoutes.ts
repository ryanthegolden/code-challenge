import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  revokeToken,
} from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', revokeToken);

export default router;
