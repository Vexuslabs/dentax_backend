import mongoose from 'mongoose';

const medicineItemSchema = new mongoose.Schema(
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
    dose: {
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
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

medicineItemSchema.virtual('medicineName').get(function () {
  return this.name;
});
medicineItemSchema.virtual('medicine').get(function () {
  return this.name;
});

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
      default: 'Routine Checkup',
      trim: true
    },
    tag: {
      type: String,
      default: ''
    },
    medicines: [medicineItemSchema],
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

// Virtual aliases for Flutter compatibility & dynamic patient resolution
prescriptionSchema.virtual('patientId').get(function () {
  if (this.patient) {
    return this.patient._id ? this.patient._id.toString() : this.patient.toString();
  }
  return null;
});
prescriptionSchema.virtual('patient_id').get(function () {
  if (this.patient) {
    return this.patient._id ? this.patient._id.toString() : this.patient.toString();
  }
  return null;
});
prescriptionSchema.virtual('name').get(function () {
  return (this.patient && this.patient.name) ? this.patient.name : this.patientName;
});
prescriptionSchema.virtual('phoneNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});
prescriptionSchema.virtual('mobileNumber').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});
prescriptionSchema.virtual('phone').get(function () {
  return (this.patient && this.patient.mobileNumber) ? this.patient.mobileNumber : '';
});

// Virtual aliases for doctor
prescriptionSchema.virtual('doctor').get(function () {
  return this.doctorName;
});
prescriptionSchema.virtual('doctor_name').get(function () {
  return this.doctorName;
});

// Virtual aliases for special instructions
prescriptionSchema.virtual('specialInstructions').get(function () {
  return this.instructions;
});
prescriptionSchema.virtual('special_instructions').get(function () {
  return this.instructions;
});
prescriptionSchema.virtual('advice').get(function () {
  return this.instructions;
});

// Virtual alias: notes (maps to diagnosis)
prescriptionSchema.virtual('notes').get(function () {
  return this.diagnosis;
});

// Virtual alias: date
prescriptionSchema.virtual('date').get(function () {
  return this.createdAt ? this.createdAt.toISOString() : new Date().toISOString();
});

export default mongoose.model('Prescription', prescriptionSchema);

