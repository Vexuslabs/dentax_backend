// 404 Not Found Handler
const notFound = (req, res, next) => {
  const error = new Error(`Resource not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global Error Handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for developers
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[API Error]: ${err.stack || err.message}`);
  }

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    error = { statusCode: 404, message };
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value entered for ${field}. Please use another value.`;
    error = { statusCode: 400, message };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = { statusCode: 400, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { statusCode: 401, message: 'Invalid authentication token.' };
  }

  if (err.name === 'TokenExpiredError') {
    error = { statusCode: 401, message: 'Authentication token expired.' };
  }

  // Multer file upload errors & custom file filter errors
  if (err.name === 'MulterError' || (err.message && (err.message.includes('Only images') || err.message.includes('Only image files')))) {
    let message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds limit (maximum allowed size reached).';
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Only a single profile image file is allowed. Multiple images are not supported.';
    }
    error = { statusCode: 400, message };
  }



  let statusCode = error.statusCode;
  if (!statusCode) {
    statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const clientMessage = (statusCode === 500 && !isDev)
    ? 'Internal Server Error'
    : (error.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(isDev && { stack: err.stack })
  });
};

export {
  notFound,
  errorHandler
};

export default {
  notFound,
  errorHandler
};
