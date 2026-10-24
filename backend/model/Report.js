import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['Payment', 'Treatment', 'Doctor', 'Patient', 'Dossier', 'Financial', 'Prescription', 'Medicine', 'General'],
      default: 'General'
    },
    fromDate: {
      type: Date,
      default: null
    },
    toDate: {
      type: Date,
      default: null
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    generatedBy: {
      type: String,
      default: 'System',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias: reportData
reportSchema.virtual('reportData').get(function () {
  return this.data;
});

export default mongoose.model('Report', reportSchema);
