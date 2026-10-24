import express from 'express';
import {
  getDashboardSummary,
  searchPatients
} from '../controller/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/summary', getDashboardSummary);
router.get('/search', searchPatients);

export default router;
