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
    totalAmount: {
      type: Number,
      default: 0
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
        type: Number
      }
    ],
    treatments: [
      {
        name: { type: String },
        price: { type: Number, default: 0 },
        subtitle: { type: String, default: '' }
      }
    ],
    medicines: [
      {
        name: { type: String },
        dosage: { type: String, default: '500mg' },
        duration: { type: String, default: '5 days' },
        timing: { type: String, default: 'After Food' }
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


// Auto-generate invoice number if missing before save
billSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const nextNum = (count + 1).toString().padLeft ? (count + 1).toString().padStart(3, '0') : String(count + 1).padStart(3, '0');
    this.invoiceNumber = `#INV-${nextNum}`;
  }
  if (!this.totalAmount) {
    const net = (this.amount || 0) - (this.discount || 0);
    this.totalAmount = net < 0 ? 0 : net;
  }
  next();
});

export default mongoose.model('Bill', billSchema);
