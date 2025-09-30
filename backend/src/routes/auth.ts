import express from 'express';
import { register, login, getMe, updateProfile, signup, verifyWorklet } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-worklet', verifyWorklet);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;
