import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    campaignType: {
      type: String,
      enum: ['SMS', 'Email', 'WhatsApp'],
      default: 'SMS'
    },
    sendTo: {
      type: String,
      default: 'All Patients'
    },
    category: {
      type: String,
      default: 'General'
    },
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true
    },
    emailSubject: {
      type: String,
      default: '',
      trim: true
    },
    header: {
      type: String,
      default: '',
      trim: true
    },
    subHeader: {
      type: String,
      default: '',
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Campaign message is required']
    },
    includePatientName: {
      type: Boolean,
      default: true
    },
    includeDoctorName: {
      type: Boolean,
      default: true
    },
    includePhone: {
      type: Boolean,
      default: true
    },
    includeClinicName: {
      type: Boolean,
      default: true
    },
    logo: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Sent', 'Draft', 'Scheduled'],
      default: 'Sent'
    },
    scheduleDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: logoUrl
campaignSchema.virtual('logoUrl').get(function () {
  return this.logo;
});

// Virtual alias: date
campaignSchema.virtual('date').get(function () {
  return this.createdAt ? this.createdAt.toISOString() : new Date().toISOString();
});

export default mongoose.model('Campaign', campaignSchema);
