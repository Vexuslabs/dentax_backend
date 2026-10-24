import mongoose from 'mongoose';

const labSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true
    },
    labName: {
      type: String,
      required: [true, 'Lab name is required'],
      trim: true
    },
    date: {
      type: String,
      default: ''
    },
    time: {
      type: String,
      default: ''
    },
    selectedTeeth: [
      {
        type: String,
        trim: true
      }
    ],
    prosthesisType: [
      {
        type: String,
        trim: true
      }
    ],
    surfaceCluster: {
      type: String,
      default: 'Glossy',
      trim: true
    },
    ponticType: {
      type: String,
      default: 'Modified Ridge Lap',
      trim: true
    },
    implantType: {
      type: String,
      default: 'Screw Retained',
      trim: true
    },
    expectedDelivery: {
      metalTrial: { type: String, default: '' },
      bisqueTrial: { type: String, default: '' },
      final: { type: String, default: '' }
    },
    charges: {
      total: { type: Number, default: 0 },
      quantity: { type: Number, default: 1 }
    },
    status: {
      type: String,
      enum: ['Pending', 'Sent', 'In Progress', 'Delivered', 'Cancelled'],
      default: 'Pending'
    },
    workStatus: {
      type: String,
      default: 'Pending'
    },
    notes: {
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
labSchema.virtual('patientId').get(function () {
  return this.patient;
});
labSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});
labSchema.virtual('phoneNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});
labSchema.virtual('mobileNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});
labSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});

// Virtual alias: teeth (maps selectedTeeth strings to numbers for Tooth Chart)
labSchema.virtual('teeth').get(function () {
  if (!this.selectedTeeth) return [];
  return this.selectedTeeth.map((t) => parseInt(t, 10)).filter((n) => !isNaN(n));
});

// Virtual alias: total
labSchema.virtual('total').get(function () {
  return this.charges ? this.charges.total : 0;
});

export default mongoose.model('Lab', labSchema);

