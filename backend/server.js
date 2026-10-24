import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ESM __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
import connectDB from './DB/connectDB.js';

// Middleware
import { notFound, errorHandler } from './middleware/error.js';
import mongoSanitize from './middleware/sanitize.js';

// Route imports
import authRoutes from './Route/authRoutes.js';
import patientRoutes from './Route/patientRoutes.js';
import visitRoutes from './Route/visitRoutes.js';
import appointmentRoutes from './Route/appointmentRoutes.js';
import billRoutes from './Route/billRoutes.js';
import prescriptionRoutes from './Route/prescriptionRoutes.js';
import accountRoutes from './Route/accountRoutes.js';
import campaignRoutes from './Route/campaignRoutes.js';
import inventoryRoutes from './Route/inventoryRoutes.js';
import labRoutes from './Route/labRoutes.js';
import reportRoutes from './Route/reportRoutes.js';
import dashboardRoutes from './Route/dashboardRoutes.js';
import subscriptionRoutes from './Route/subscriptionRoutes.js';
import notificationRoutes from './Route/notificationRoutes.js';
import uploadRoutes from './Route/uploadRoutes.js';
import queueRoutes from './Route/queueRoutes.js';

// Initialize Express app
const app = express();

// Disable powered-by header for security
app.disable('x-powered-by');

// Connect to Database
connectDB();

// Security Headers Middleware (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false // Allow API responses and static assets
  })
);

// CORS configuration (supports Flutter mobile and web with whitelist)
const allowedOrigins = process.env.CLIENT_URL && process.env.CLIENT_URL !== '*'
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin ${origin} not permitted`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  })
);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL Query Injection Sanitization
app.use(mongoSanitize);

// General API Rate Limiting (1000 requests per 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 5000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static folder for file uploads (logos, signatures, attachments)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'MediBook / DentalBox Backend API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    uptime: process.uptime(),
    status: 'Healthy',
    database: 'Connected'
  });
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/queue', queueRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Port Configuration
const PORT = process.env.PORT || 5000;

// Start Server (only when run directly)
const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (isMain) {
  app.listen(PORT, () => {
    console.log(`[DentalBox Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

export default app;
