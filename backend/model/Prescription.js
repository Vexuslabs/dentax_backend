import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema(
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
      default: 'Dr. Self',
      trim: true
    },
    diagnosis: {
      type: String,
      required: [true, 'Diagnosis is required'],
      trim: true
    },
    tag: {
      type: String,
      default: ''
    },
    medicines: [
      {
        name: {
          type: String,
          required: [true, 'Medicine name is required'],
          trim: true
        },
        dosage: {
          type: String,
          default: ''
        },
        duration: {
          type: String,
          default: ''
        },
        timing: {
          type: String,
          default: ''
        }
      }
    ],
    instructions: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Cancelled'],
      default: 'Active'
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

// Virtual alias: notes (maps to diagnosis)
prescriptionSchema.virtual('notes').get(function () {
  return this.diagnosis;
});

// Virtual alias: date
prescriptionSchema.virtual('date').get(function () {
  return this.createdAt ? this.createdAt.toISOString() : new Date().toISOString();
});

export default mongoose.model('Prescription', prescriptionSchema);
