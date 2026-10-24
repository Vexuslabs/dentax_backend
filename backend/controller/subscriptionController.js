import crypto from 'crypto';
import { SubscriptionPlan, UserSubscription } from '../model/Subscription.js';
import { isValidObjectId } from '../utils/helpers.js';

// Default initial plans
const defaultPlans = [
  {
    planId: 'razor_monthly',
    name: 'monthly',
    price: 999,
    amount: 999,
    features: [
      'Unlimited Patient Records',
      'Cloud Backup & Sync',
      'Automated Appointment Reminders',
      'Digital E-Prescriptions',
      '24/7 Dedicated Support'
    ],
    popular: true
  },
  {
    planId: 'razor_quarterly',
    name: 'quarterly',
    price: 2499,
    amount: 2499,
    features: [
      'Everything in Monthly',
      'Custom Clinic Branding',
      'Multi-Doctor & Staff Access',
      'Advanced Financial Analytics'
    ],
    popular: false
  },
  {
    planId: 'razor_annual',
    name: 'yearly',
    price: 7999,
    amount: 7999,
    features: [
      'Everything in Quarterly',
      'Unlimited WhatsApp Notifications',
      'Priority VIP Support',
      'Dedicated Account Manager'
    ],
    popular: false
  }
];

// Helper to calculate expiration date based on plan name
const calculateExpirationDate = (planName, startDate = new Date()) => {
  const expiry = new Date(startDate);
  if (planName === 'yearly') {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else if (planName === 'quarterly') {
    expiry.setMonth(expiry.getMonth() + 3);
  } else {
    expiry.setMonth(expiry.getMonth() + 1);
  }
  return expiry;
};

// @desc    Get public Razorpay Key ID
// @route   GET /api/subscriptions/key
// @access  Public
const getRazorpayKey = async (req, res, next) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    res.status(200).json({
      success: true,
      keyId,
      key: keyId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
const getPlans = async (req, res, next) => {
  try {
    let plans = await SubscriptionPlan.find();

    // If database is empty, seed defaults
    if (!plans || plans.length === 0) {
      plans = await SubscriptionPlan.insertMany(defaultPlans);
    }

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Razorpay Order for Subscription
// @route   POST /api/subscriptions/create-order
// @access  Protected
const createSubscriptionOrder = async (req, res, next) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay credentials are not configured on the server.'
      });
    }

    const requestedPlanId = (req.body.planId || req.body.plan || 'razor_monthly').toString().trim();
    let plan = await SubscriptionPlan.findOne({
      $or: [
        { planId: requestedPlanId },
        { _id: isValidObjectId(requestedPlanId) ? requestedPlanId : null },
        { name: requestedPlanId.toLowerCase() }
      ]
    });

    if (!plan) {
      plan = await SubscriptionPlan.findOne({ planId: 'razor_monthly' });
      if (!plan) {
        const seeded = await SubscriptionPlan.insertMany(defaultPlans);
        plan = seeded[0];
      }
    }

    const rawAmount = req.body.amount || plan.price || plan.amount || 999;
    const amountInPaise = Math.round(Number(rawAmount) * 100);
    const currency = (req.body.currency || 'INR').toUpperCase();
    const userId = req.user ? req.user.id.toString() : 'guest';
    const receipt = req.body.receipt || `rcpt_${Date.now()}_${userId.slice(-6)}`;

    // Invoke Razorpay Orders API
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderPayload = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        userId,
        planId: plan.planId,
        planName: plan.name
      }
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: orderData.error?.description || 'Failed to generate Razorpay order.',
        error: orderData
      });
    }

    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        orderId: orderData.id,
        id: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        receipt: orderData.receipt,
        keyId,
        key: keyId,
        plan: {
          planId: plan.planId,
          name: plan.name,
          price: plan.price
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Activate subscription for clinic / doctor
// @route   POST /api/subscriptions/activate
// @access  Protected
const activateSubscription = async (req, res, next) => {
  try {
    const { planId, paymentId } = req.body;

    if (!planId || typeof planId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid Plan ID string is required.'
      });
    }

    const trimmedPlanId = planId.trim();
    const plan = await SubscriptionPlan.findOne({
      $or: [
        { planId: trimmedPlanId },
        { _id: isValidObjectId(trimmedPlanId) ? trimmedPlanId : null }
      ]
    });

    const now = new Date();
    const expiry = calculateExpirationDate(plan?.name, now);
    const userId = req.user ? req.user.id : '000000000000000000000001';

    // Mark previous active subscriptions for this user as superseded
    await UserSubscription.updateMany(
      { user: userId, status: 'active' },
      { $set: { status: 'cancelled' } }
    );

    const subscription = await UserSubscription.create({
      user: userId,
      planId: plan ? plan.planId : planId,
      planName: plan ? plan.name : 'monthly',
      status: 'active',
      startDate: now,
      endDate: expiry,
      razorpayPaymentId: paymentId || `pay_${Date.now()}`
    });

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay payment signature & activate subscription
// @route   POST /api/subscriptions/verify
// @access  Protected
const verifySubscriptionPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      orderId,
      razorpay_payment_id,
      paymentId,
      razorpay_signature,
      signature,
      planId
    } = req.body;

    const resolvedOrderId = (razorpay_order_id || orderId || '').trim();
    const resolvedPaymentId = (razorpay_payment_id || paymentId || '').trim();
    const resolvedSignature = (razorpay_signature || signature || '').trim();

    if (!resolvedPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required.'
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Verify HMAC SHA256 signature when secret and order ID/signature are present
    if (secret && resolvedOrderId && resolvedSignature) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${resolvedOrderId}|${resolvedPaymentId}`)
        .digest('hex');

      if (generatedSignature !== resolvedSignature) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed: Invalid Razorpay signature.'
        });
      }
    }

    const trimmedPlanId = (planId || 'razor_monthly').toString().trim();
    const plan = await SubscriptionPlan.findOne({
      $or: [
        { planId: trimmedPlanId },
        { _id: isValidObjectId(trimmedPlanId) ? trimmedPlanId : null },
        { name: trimmedPlanId.toLowerCase() }
      ]
    });

    const now = new Date();
    const expiry = calculateExpirationDate(plan?.name, now);
    const userId = req.user ? req.user.id : '000000000000000000000001';

    // Mark previous active subscriptions for this user as superseded
    await UserSubscription.updateMany(
      { user: userId, status: 'active' },
      { $set: { status: 'cancelled' } }
    );

    const subscription = await UserSubscription.create({
      user: userId,
      planId: plan ? plan.planId : trimmedPlanId,
      planName: plan ? plan.name : 'monthly',
      status: 'active',
      startDate: now,
      endDate: expiry,
      razorpayPaymentId: resolvedPaymentId,
      razorpayOrderId: resolvedOrderId,
      razorpaySignature: resolvedSignature
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated successfully',
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current active subscription for authenticated doctor
// @route   GET /api/subscriptions/current
// @access  Protected
const getActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const subscription = await UserSubscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasActiveSubscription: false,
        daysRemaining: 0,
        data: null,
        message: 'No active subscription found'
      });
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    );

    res.status(200).json({
      success: true,
      hasActiveSubscription: true,
      daysRemaining,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

export {
  getRazorpayKey,
  getPlans,
  createSubscriptionOrder,
  activateSubscription,
  verifySubscriptionPayment,
  getActiveSubscription
};

export default {
  getRazorpayKey,
  getPlans,
  createSubscriptionOrder,
  activateSubscription,
  verifySubscriptionPayment,
  getActiveSubscription
};

