import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderNumber: {
      type: String,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      default: '',
      trim: true
    },
    subtitle: {
      type: String,
      default: '',
      trim: true
    },
    vendor: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true
    },
    date: {
      type: String,
      default: () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    status: {
      type: String,
      enum: ['Pending', 'Ordered', 'Delivered', 'Cancelled'],
      default: 'Pending'
    },
    items: [
      {
        productName: { type: String, trim: true },
        quantity: { type: Number, default: 1 },
        price: { type: Number, default: 0 }
      }
    ],
    totalAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Auto-assign orderNumber & title if missing
purchaseOrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    const nextId = 1001 + count;
    this.orderNumber = `${nextId}`;
  }
  if (!this.title) {
    this.title = `Order #${this.orderNumber}`;
  }
  next();
});

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
