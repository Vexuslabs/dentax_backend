import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// General file filter (accept images and pdfs)
const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

  if (allowedExts.has(ext) && allowedMimes.has(mimetype)) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, JPG, PNG, WEBP) and PDFs are allowed.'));
  }
};

// Strict profile image filter (only JPEG, JPG, PNG, WEBP; NO PDFs)
const profileImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const profileImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const profileImageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

  if (profileImageExts.has(ext) && profileImageMimes.has(mimetype)) {
    return cb(null, true);
  } else {
    const error = new Error('Only image files (JPEG, JPG, PNG, WEBP) are allowed for profile images.');
    error.statusCode = 400;
    cb(error);
  }
};


const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: fileFilter
});

// Dedicated single profile image upload (strictly 1 file, images only)
const uploadProfileImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1 // Strictly 1 file max
  },
  fileFilter: profileImageFilter
});

export {
  upload,
  uploadProfileImage
};

export default upload;

