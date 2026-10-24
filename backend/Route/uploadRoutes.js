import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { upload, uploadProfileImage } from '../middleware/upload.js';
import { optionalAuth } from '../middleware/auth.js';
import User from '../model/User.js';

const router = express.Router();

router.use(optionalAuth);

// Check if Cloudinary credentials are configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

// Helper middleware to strictly enforce single profile image upload
const singleProfileImageMiddleware = (req, res, next) => {
  uploadProfileImage.any()(req, res, (err) => {
    if (err) return next(err);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a profile image in the form-data request.'
      });
    }
    if (req.files.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Only a single profile image file is allowed. Multiple images are not supported.'
      });
    }
    req.file = req.files[0];
    next();
  });
};

// Common handler for single file/image processing
const processSingleUpload = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a file in the form-data request.'
      });
    }

    let fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    let relativePath = `/uploads/${file.filename}`;

    // Attempt Cloudinary upload if configured
    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'dentax',
          resource_type: 'auto'
        });
        fileUrl = result.secure_url;
        relativePath = result.secure_url;
      } catch (cloudErr) {
        console.warn('[Upload] Cloudinary upload failed, falling back to local storage:', cloudErr.message);
      }
    }

    // If authenticated doctor/user, automatically update avatar
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { avatar: relativePath });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      url: fileUrl,
      path: relativePath,
      avatar: fileUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload profile image (strictly single image file)
// @route   POST /api/upload/profile or POST /api/upload/avatar
// @access  Public / Protected
router.post('/profile', singleProfileImageMiddleware, processSingleUpload);
router.post('/avatar', singleProfileImageMiddleware, processSingleUpload);

// @desc    General upload (supports single file, strictly rejects multiple profile images)
// @route   POST /api/upload
// @access  Public / Protected
router.post('/', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a file in the form-data request.'
      });
    }
    if (req.files.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Only a single profile image file is allowed. Multiple images are not supported.'
      });
    }
    req.file = req.files[0];
    next();
  });
}, processSingleUpload);

export default router;
