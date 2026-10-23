import express from 'express';
import {
  getDashboardSummary,
  searchPatients
} from '../controller/dashboardController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/summary', getDashboardSummary);
router.get('/search', searchPatients);

export default router;
