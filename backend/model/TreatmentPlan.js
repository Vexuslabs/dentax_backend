import mongoose from 'mongoose';

const treatmentPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    planNumber: {
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
    clinicName: {
      type: String,
      default: 'My Dental Clinic',
      trim: true
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    clinicalNotes: {
      complaint: {
        type: String,
        default: '',
        trim: true
      },
      observations: {
        type: String,
        default: '',
        trim: true
      },
      investigation: {
        type: String,
        default: '',
        trim: true
      },
      diagnosis: {
        type: String,
        default: '',
        trim: true
      }
    },
    treatment: {
      type: String,
      default: '',
      trim: true
    },
    treatments: [
      {
        name: { type: String, trim: true },
        fees: { type: Number, default: 0 },
        cost: { type: Number, default: 0 },
        notes: { type: String, default: '' }
      }
    ],
    fees: {
      type: Number,
      default: 0,
      min: [0, 'Fees cannot be negative']
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
      enum: ['Draft', 'Proposed', 'Accepted', 'In Progress', 'Completed', 'Cancelled'],
      default: 'Proposed'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for Flutter compatibility & dynamic patient resolution
treatmentPlanSchema.virtual('patientId').get(function () {
  return this.patient;
});

treatmentPlanSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});

treatmentPlanSchema.virtual('mobileNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});

treatmentPlanSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});

treatmentPlanSchema.virtual('complaint').get(function () {
  return this.clinicalNotes?.complaint || '';
});

treatmentPlanSchema.virtual('observations').get(function () {
  return this.clinicalNotes?.observations || '';
});

treatmentPlanSchema.virtual('investigation').get(function () {
  return this.clinicalNotes?.investigation || '';
});

treatmentPlanSchema.virtual('diagnosis').get(function () {
  return this.clinicalNotes?.diagnosis || '';
});

// Auto-generate planNumber and totalAmount before saving
treatmentPlanSchema.pre('save', async function (next) {
  if (!this.planNumber) {
    const count = await this.constructor.countDocuments();
    const nextNum = String(count + 1).padStart(3, '0');
    this.planNumber = `#TP-${nextNum}`;
  }
  if (this.totalAmount === undefined || this.totalAmount === 0) {
    const calculatedTotal = (this.fees || 0) - (this.discount || 0);
    this.totalAmount = calculatedTotal < 0 ? 0 : calculatedTotal;
  }
  next();
});

export default mongoose.model('TreatmentPlan', treatmentPlanSchema);
