import mongoose from 'mongoose';

const queueSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null
    },
    tokenNumber: {
      type: Number,
      required: true
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true
    },
    department: {
      type: String,
      default: 'Dental',
      trim: true
    },
    doctorName: {
      type: String,
      default: 'Dr. Self',
      trim: true
    },
    status: {
      type: String,
      enum: ['Waiting', 'In-Consultation', 'Completed', 'Cancelled'],
      default: 'Waiting'
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 15
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
queueSchema.virtual('patientId').get(function () {
  return this.patient;
});
queueSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});
queueSchema.virtual('mobileNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});
queueSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.phoneNumber;
});

export default mongoose.model('Queue', queueSchema);

