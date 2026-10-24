import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  setupClinic,
  logout,
  refreshTokenHandler,
  uploadAvatar
} from '../controller/authController.js';
import { protect } from '../middleware/auth.js';
import { upload, uploadProfileImage } from '../middleware/upload.js';

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
router.post('/refresh-token', refreshTokenHandler);
router.post('/refresh', refreshTokenHandler);
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
router.post(
  '/profile/avatar',
  protect,
  (req, res, next) => {
    uploadProfileImage.single('avatar')(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        // Also check if field was named 'image' or 'file'
        return uploadProfileImage.single('image')(req, res, (err2) => {
          if (err2) return next(err2);
          if (!req.file) {
            return uploadProfileImage.single('file')(req, res, next);
          }
          next();
        });
      }
      next();
    });
  },
  uploadAvatar
);
router.post('/setup-clinic', protect, setupClinic);

export default router;
