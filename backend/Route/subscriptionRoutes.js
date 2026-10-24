import express from 'express';
import {
  getRazorpayKey,
  getPlans,
  createSubscriptionOrder,
  activateSubscription,
  verifySubscriptionPayment,
  getActiveSubscription
} from '../controller/subscriptionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public endpoints to view subscription tiers & retrieve client Razorpay key
router.get('/plans', getPlans);
router.get('/key', getRazorpayKey);

// Protected endpoints for doctor subscription checkout, verification & status
router.post('/create-order', protect, createSubscriptionOrder);
router.post('/order', protect, createSubscriptionOrder);
router.post('/activate', protect, activateSubscription);
router.post('/verify', protect, verifySubscriptionPayment);
router.get('/current', protect, getActiveSubscription);
router.get('/active', protect, getActiveSubscription);

export default router;

