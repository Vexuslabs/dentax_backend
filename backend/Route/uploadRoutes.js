import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import upload from '../middleware/upload.js';
import { optionalAuth } from '../middleware/auth.js';

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

// @desc    Upload file or image (Cloudinary with local storage fallback)
// @route   POST /api/upload
// @access  Public / Protected
router.post('/', upload.any(), async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0]);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a file in the form-data request.'
      });
    }

    // Attempt Cloudinary upload if configured
    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'dentax',
          resource_type: 'auto'
        });

        return res.status(200).json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes
        });
      } catch (cloudErr) {
        console.warn('[Upload] Cloudinary upload failed, falling back to local storage:', cloudErr.message);
      }
    }

    // Default / Local server storage
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    return res.status(200).json({
      success: true,
      url: fileUrl,
      path: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    });
  } catch (err) {
    next(err);
  }
});

export default router;
