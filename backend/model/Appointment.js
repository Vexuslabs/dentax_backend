import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
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
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    department: {
      type: String,
      enum: ['Dental', 'Orthodontics', 'Implant', 'General'],
      default: 'Dental'
    },
    doctorName: {
      type: String,
      default: 'Dr. Self',
      trim: true
    },
    visitType: {
      type: String,
      default: 'Consultation',
      trim: true
    },
    appointmentDate: {
      type: String,
      required: [true, 'Appointment date is required']
    },
    appointmentTime: {
      type: String,
      required: [true, 'Appointment time is required']
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Confirmed', 'Checked In', 'Engaged', 'Completed', 'Missed', 'Cancelled'],
      default: 'Scheduled'
    },
    notes: {
      type: String,
      default: ''
    },
    gender: {
      type: String,
      enum: ['M', 'F', 'Male', 'Female', 'Other'],
      default: 'M'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for Flutter compatibility
appointmentSchema.virtual('name').get(function () {
  return this.patientName;
});
appointmentSchema.virtual('mobileNumber').get(function () {
  return this.phoneNumber;
});
appointmentSchema.virtual('phone').get(function () {
  return this.phoneNumber;
});
appointmentSchema.virtual('date').get(function () {
  return this.appointmentDate;
});
appointmentSchema.virtual('time').get(function () {
  return this.appointmentTime;
});

export default mongoose.model('Appointment', appointmentSchema);
