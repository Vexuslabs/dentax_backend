import mongoose from 'mongoose';

const toothDetailSchema = new mongoose.Schema(
  {
    condition: {
      type: String,
      default: ''
    },
    treatmentDone: {
      type: String,
      default: ''
    },
    treatmentPlanned: {
      type: String,
      default: ''
    },
    history: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const dentalChartSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    teeth: {
      type: Map,
      of: toothDetailSchema,
      default: () => new Map()
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export default mongoose.model('DentalChart', dentalChartSchema);
