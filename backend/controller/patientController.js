import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Appointment from '../model/Appointment.js';
import Bill from '../model/Bill.js';
import Prescription from '../model/Prescription.js';
import DentalChart from '../model/DentalChart.js';
import Queue from '../model/Queue.js';
import Lab from '../model/Lab.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Create new patient
// @route   POST /api/patients
// @access  Protected
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

// @desc    Get all patients with filters & search (doctor-isolated)
// @route   GET /api/patients
// @access  Protected
const getAllPatients = async (req, res, next) => {
  try {
    const { q, gender, startDate, endDate, sort, order } = req.query;

    const andConditions = [];

    // Strictly scope to current authenticated doctor
    const doctorQuery = getDoctorFilter(req);
    andConditions.push(doctorQuery);

    // Search query for name, mobile number, adhar
    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      andConditions.push({
        $or: [
          { name: searchRegex },
          { mobileNumber: searchRegex },
          { 'personalInfo.adharNumber': searchRegex }
        ]
      });
    }

    // Gender filter
    if (gender && gender !== 'All') {
      andConditions.push({ gender });
    }

    // Date range filter
    if (startDate || endDate) {
      const dateCondition = {};
      if (startDate) dateCondition.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateCondition.$lte = end;
      }
      andConditions.push({ createdAt: dateCondition });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

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
// @access  Protected
const getPatientById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const doctorScope = getDoctorFilter(req);

    // Fetch related clinical records linked by patient ID and doctor scope
    const [visits, appointments, bills, prescriptions, dentalChart] = await Promise.all([
      PatientVisit.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ createdAt: -1 }),
      Appointment.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ appointmentDate: -1 }),
      Bill.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ createdAt: -1 }),
      Prescription.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ createdAt: -1 }),
      DentalChart.findOne({ patient: patient._id })
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...patient.toObject(),
        visits,
        appointments,
        bills,
        prescriptions,
        dentalChart: dentalChart ? dentalChart.teeth : {}
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Protected
const updatePatient = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const updateData = { ...req.body };
    delete updateData.user; // Protect against doctor reassignment

    const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    // Synchronize updated patient details and contact numbers across all linked database records
    if (updateData.name || updateData.patientName || updateData.mobileNumber || updateData.phone) {
      const newName = (updateData.name || updateData.patientName || updatedPatient.name).trim();
      const newPhone = (updateData.mobileNumber || updateData.phone || updatedPatient.mobileNumber).trim();

      await Promise.all([
        Appointment.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName, phoneNumber: newPhone } }
        ),
        Bill.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName, phoneNumber: newPhone } }
        ),
        PatientVisit.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName, mobileNumber: newPhone } }
        ),
        Prescription.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName } }
        ),
        Queue.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName, phoneNumber: newPhone } }
        ),
        Lab.updateMany(
          { patient: updatedPatient._id },
          { $set: { patientName: newName } }
        )
      ]);
    }

    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: updatedPatient
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete patient
// @route   DELETE /api/patients/:id
// @access  Protected
const deletePatient = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);

    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    await patient.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient dental chart (odontogram)
// @route   GET /api/patients/:id/dental-chart
// @access  Protected
const getDentalChart = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let chart = await DentalChart.findOne({ patient: patient._id });
    if (!chart) {
      chart = {
        patient: patient._id,
        teeth: {}
      };
    }

    res.status(200).json({
      success: true,
      data: chart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update patient dental chart (odontogram)
// @route   PUT /api/patients/:id/dental-chart
// @access  Protected
const updateDentalChart = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const teethUpdates = req.body.teeth !== undefined ? req.body.teeth : req.body;

    let chart = await DentalChart.findOne({ patient: patient._id });

    if (!chart) {
      chart = new DentalChart({
        patient: patient._id,
        user: req.user ? req.user.id : null,
        teeth: new Map()
      });
    }

    if (teethUpdates && typeof teethUpdates === 'object') {
      for (const [toothKey, val] of Object.entries(teethUpdates)) {
        if (toothKey === 'user' || toothKey === 'patient' || toothKey === '_id') continue;
        const existing = chart.teeth.get(toothKey);
        const existingObj = existing ? (typeof existing.toObject === 'function' ? existing.toObject() : existing) : {};
        const incomingObj = typeof val === 'object' && val !== null ? val : { condition: String(val) };
        chart.teeth.set(toothKey, {
          ...existingObj,
          ...incomingObj,
          updatedAt: new Date()
        });
      }
    }

    if (req.user) {
      chart.user = req.user.id;
    }

    await chart.save();

    res.status(200).json({
      success: true,
      message: 'Dental chart updated successfully',
      data: chart
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
  deletePatient,
  getDentalChart,
  updateDentalChart
};

export default {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getDentalChart,
  updateDentalChart
};
