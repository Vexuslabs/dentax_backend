import express from 'express';
import {
  getPlans,
  activateSubscription
} from '../controller/subscriptionController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/plans', getPlans);
router.post('/activate', activateSubscription);

export default router;
