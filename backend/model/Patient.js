import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      index: true
    },
    dob: {
      type: String,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male'
    },
    age: {
      type: Number,
      default: 0
    },
    personalInfo: {
      anniversary: { type: String, default: null },
      emergencyContact: {
        name: { type: String, default: '' },
        phoneNumber: { type: String, default: '' }
      },
      address: {
        street: { type: String, default: '' }
      },
      adharNumber: { type: String, default: '' },
      notes: { type: String, default: '' }
    },
    medicalDetails: {
      conditions: [
        {
          name: { type: String, trim: true }
        }
      ]
    },
    preferences: {
      language: { type: String, default: 'English' },
      membership: { type: String, default: 'Silver' },
      group: { type: String, default: 'Regular' }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: patientName
patientSchema.virtual('patientName').get(function () {
  return this.name;
});

// Virtual alias: phone
patientSchema.virtual('phone').get(function () {
  return this.mobileNumber;
});

// Auto-calculate age if dob is valid and age is 0
patientSchema.pre('save', function (next) {
  if (this.dob && (!this.age || this.age === 0)) {
    try {
      const birthDate = new Date(this.dob);
      if (!isNaN(birthDate.getTime())) {
        const diff = Date.now() - birthDate.getTime();
        const ageDate = new Date(diff);
        this.age = Math.abs(ageDate.getUTCFullYear() - 1970);
      }
    } catch (_) {}
  }
  next();
});

export default mongoose.model('Patient', patientSchema);
