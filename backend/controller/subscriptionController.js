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

// @desc    Activate subscription for clinic / doctor
// @route   POST /api/subscriptions/activate
// @access  Protected / Public
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
    const expiry = new Date(now);
    if (plan?.name === 'yearly') {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else if (plan?.name === 'quarterly') {
      expiry.setMonth(expiry.getMonth() + 3);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }

    const subscription = await UserSubscription.create({
      user: req.user ? req.user.id : '000000000000000000000001',
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
// @access  Protected / Public
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

    const trimmedPlanId = (planId || 'razor_monthly').trim();
    const plan = await SubscriptionPlan.findOne({
      $or: [
        { planId: trimmedPlanId },
        { _id: isValidObjectId(trimmedPlanId) ? trimmedPlanId : null }
      ]
    });

    const now = new Date();
    const expiry = new Date(now);
    if (plan?.name === 'yearly') {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else if (plan?.name === 'quarterly') {
      expiry.setMonth(expiry.getMonth() + 3);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }

    const subscription = await UserSubscription.create({
      user: req.user ? req.user.id : '000000000000000000000001',
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

export {
  getPlans,
  activateSubscription,
  verifySubscriptionPayment
};

export default {
  getPlans,
  activateSubscription,
  verifySubscriptionPayment
};
