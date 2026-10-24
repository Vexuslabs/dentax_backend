import mongoose from 'mongoose';

const patientVisitSchema = new mongoose.Schema(
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
      default: 'Dr. Self',
      trim: true
    },
    mobileNumber: {
      type: String,
      trim: true
    },
    visitDate: {
      type: Date,
      default: Date.now
    },
    visitTime: {
      type: String,
      default: '10:00'
    },
    isNewPatient: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
      default: 'Completed'
    },
    complaints: [
      {
        type: String,
        trim: true
      }
    ],
    observations: [
      {
        text: { type: String, trim: true }
      }
    ],
    diagnosis: [
      {
        text: { type: String, trim: true }
      }
    ],
    vitals: {
      bp: { type: String, default: '120/80' },
      pulse: { type: String, default: '72' },
      temp: { type: String, default: '98.6' }
    },
    actualTreatmentDone: {
      type: String,
      default: ''
    },
    treatmentSuggested: {
      fees: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      treatments: [{ type: String }],
      medicines: [
        {
          name: { type: String },
          dosage: { type: String, default: '' },
          duration: { type: String, default: '' },
          timing: { type: String, default: '' }
        }
      ]
    },
    advice: {
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
patientVisitSchema.virtual('patientId').get(function () {
  return this.patient;
});
patientVisitSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});
patientVisitSchema.virtual('phoneNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.mobileNumber;
});
patientVisitSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : this.mobileNumber;
});

export default mongoose.model('PatientVisit', patientVisitSchema);

