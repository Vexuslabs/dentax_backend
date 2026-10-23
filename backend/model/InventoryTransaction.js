import mongoose from 'mongoose';

const inventoryTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    type: {
      type: String,
      enum: ['Stock In', 'Stock Out', 'Adjustment'],
      required: [true, 'Transaction type is required']
    },
    title: {
      type: String,
      required: [true, 'Title (Product Name) is required'],
      trim: true
    },
    category: {
      type: String,
      default: 'Inward',
      trim: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1']
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Amount cannot be negative']
    },
    remarks: {
      type: String,
      default: '',
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default mongoose.model('InventoryTransaction', inventoryTransactionSchema);
