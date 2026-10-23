import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


const userSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      enum: ['Dr', 'Mr', 'Mrs', 'Ms', 'Dt'],
      default: 'Dr'
    },
    name: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['Admin', 'Doctor', 'User', 'Staff'],
      default: 'Doctor'
    },
    clinicName: {
      type: String,
      default: 'My Dental Clinic',
      trim: true
    },
    clinicContact: {
      type: String,
      trim: true,
      default: ''
    },
    doctorType: {
      type: String,
      default: 'Doctor'
    },
    occupation: {
      type: String,
      default: 'Dentist'
    },
    licenseNo: {
      type: String,
      default: ''
    },
    template: {
      header: { type: String, default: '' },
      footer: { type: String, default: '' },
      logo: { type: String, default: '' },
      signature: { type: String, default: '' },
      showPhone: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: true },
      showAddress: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'dentalbox_super_secret_jwt_key_2026_secure',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d'
    }
  );
};

export default mongoose.model('User', userSchema);
