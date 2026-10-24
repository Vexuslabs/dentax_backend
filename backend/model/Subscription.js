import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    razorpay_plan_id: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      required: true,
      enum: ['monthly', 'quarterly', 'yearly'],
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      default: 0
    },
    features: [
      {
        type: String
      }
    ],
    popular: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

subscriptionPlanSchema.pre('save', function (next) {
  if (!this.amount) {
    this.amount = this.price;
  }
  if (!this.razorpay_plan_id) {
    this.razorpay_plan_id = this.planId;
  }
  next();
});

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    planId: {
      type: String,
      required: true
    },
    planName: {
      type: String,
      default: 'monthly'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'trial', 'cancelled'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    razorpayPaymentId: {
      type: String,
      default: ''
    },
    razorpayOrderId: {
      type: String,
      default: ''
    },
    razorpaySignature: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);

export {
  SubscriptionPlan,
  UserSubscription
};

export default {
  SubscriptionPlan,
  UserSubscription
};
