import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Appointment from '../model/Appointment.js';
import Bill from '../model/Bill.js';
import Prescription from '../model/Prescription.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

// @desc    Create new patient
// @route   POST /api/patients
// @access  Public / Protected
const createPatient = async (req, res, next) => {
  try {
    const {
      name,
      patientName,
      mobileNumber,
      phone,
      dob,
      gender,
      age,
      personalInfo,
      medicalDetails,
      preferences
    } = req.body;

    const resolvedName = (name || patientName || '').trim();
    const resolvedPhone = (mobileNumber || phone || '').trim();

    if (!resolvedName || !resolvedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and mobile number are required.'
      });
    }

    const patient = await Patient.create({
      user: req.user ? req.user.id : null,
      name: resolvedName,
      mobileNumber: resolvedPhone,
      dob: dob || new Date(2000, 0, 1).toISOString().split('T')[0],
      gender: gender || 'Male',
      age: age || 0,
      personalInfo: personalInfo || {},
      medicalDetails: medicalDetails || { conditions: [] },
      preferences: preferences || { language: 'English', membership: 'Silver', group: 'Regular' }
    });

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all patients with filters & search
// @route   GET /api/patients
// @access  Public / Protected
const getAllPatients = async (req, res, next) => {
  try {
    const { q, gender, startDate, endDate, sort, order } = req.query;

    const andConditions = [];

    // Scope to user if authenticated
    if (req.user) {
      andConditions.push({ $or: [{ user: req.user.id }, { user: null }] });
    }

    // Search query for name or mobile number
    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      andConditions.push({
        $or: [
          { name: searchRegex },
          { mobileNumber: searchRegex }
        ]
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    // Gender filter
    if (gender && gender !== 'All') {
      filter.gender = gender;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sort) {
      const sortDirection = order === 'asc' ? 1 : -1;
      if (sort === 'name') sortOptions = { name: sortDirection };
      if (sort === 'gender') sortOptions = { gender: sortDirection };
      if (sort === 'date' || sort === 'createdAt') sortOptions = { createdAt: sortDirection };
    }

    const patients = await Patient.find(filter).sort(sortOptions);

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient by ID with complete clinical dossier
// @route   GET /api/patients/:id
// @access  Public / Protected
const getPatientById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Fetch related clinical records
    const [visits, appointments, bills, prescriptions] = await Promise.all([
      PatientVisit.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }).sort({ createdAt: -1 }),
      Appointment.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }).sort({ appointmentDate: -1 }),
      Bill.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }).sort({ createdAt: -1 }),
      Prescription.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...patient.toObject(),
        visits,
        appointments,
        bills,
        prescriptions
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Public / Protected
const updatePatient = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const updateData = { ...req.body };
    delete updateData.user; // Protect against user reassignment

    const patient = await Patient.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Public / Protected
const deletePatient = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findByIdAndDelete(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
};

export default {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient
};
