import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
      index: true
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ''
    },
    doctorName: {
      type: String,
      default: 'Dr. Self',
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Bill amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: [0, 'Due amount cannot be negative']
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Partially Paid', 'Cancelled'],
      default: 'Pending'
    },
    paymentMethod: {
      type: String,
      enum: ['Pending', 'Cash', 'Card', 'UPI', 'Net Banking'],
      default: 'Pending'
    },
    notes: {
      type: String,
      default: ''
    },
    // Quick Bill specific fields
    isQuickBill: {
      type: Boolean,
      default: false
    },
    isPediatric: {
      type: Boolean,
      default: false
    },
    selectedTeeth: [
      {
        type: mongoose.Schema.Types.Mixed
      }
    ],
    treatments: [
      {
        name: { type: String, trim: true },
        price: { type: Number, default: 0 },
        cost: { type: Number, default: 0 },
        fees: { type: Number, default: 0 },
        subtitle: { type: String, default: '', trim: true },
        description: { type: String, default: '', trim: true },
        quantity: { type: Number, default: 1 }
      }
    ],
    medicines: [
      {
        name: { type: String, trim: true },
        dosage: { type: String, default: '500mg' },
        duration: { type: String, default: '5 days' },
        timing: { type: String, default: 'After Food' },
        frequency: { type: String, default: '' }
      }
    ],
    diagnosis: {
      type: String,
      default: 'Dental Treatment'
    },
    instructions: {
      type: String,
      default: ''
    },
    followUpDate: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for Flutter compatibility & dynamic patient resolution
billSchema.virtual('patientId').get(function () {
  return this.patient;
});
billSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});
billSchema.virtual('mobileNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});
billSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});
billSchema.virtual('grossFees').get(function () {
  return this.amount;
});
billSchema.virtual('netAmount').get(function () {
  return this.totalAmount;
});
billSchema.virtual('pediatric').get(function () {
  return this.isPediatric;
});

// Auto-generate invoice number and sync financials if missing before save
billSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const nextNum = (count + 1).toString().padLeft ? (count + 1).toString().padStart(3, '0') : String(count + 1).padStart(3, '0');
    this.invoiceNumber = `#INV-${nextNum}`;
  }
  if (this.totalAmount == null || this.totalAmount === 0) {
    const net = (this.amount || 0) - (this.discount || 0) + (this.tax || 0);
    this.totalAmount = net < 0 ? 0 : net;
  }
  if (this.dueAmount == null) {
    const due = (this.totalAmount || 0) - (this.paidAmount || 0);
    this.dueAmount = due < 0 ? 0 : due;
  }
  next();
});

export default mongoose.model('Bill', billSchema);
