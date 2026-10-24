import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  setupClinic,
  logout
} from '../controller/authController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

import rateLimit from 'express-rate-limit';

const router = express.Router();

// Brute-force protection for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Public endpoints
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Protected endpoints
router.get('/me', protect, getMe);
router.get('/profile', protect, getMe);
router.put(
  '/profile',
  protect,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'avatar', maxCount: 1 }
  ]),
  updateProfile
);
router.post('/setup-clinic', protect, setupClinic);

export default router;
