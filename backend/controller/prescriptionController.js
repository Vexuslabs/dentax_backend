import Prescription from '../model/Prescription.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

// @desc    Create new prescription
// @route   POST /api/prescriptions
// @access  Public / Protected
const createPrescription = async (req, res, next) => {
  try {
    const {
      patientId,
      patientName,
      doctorName,
      diagnosis,
      notes,
      tag,
      medicines,
      instructions,
      status,
      followUpDate
    } = req.body;

    const resolvedPatientName = (patientName || '').trim();
    const resolvedDiagnosis = (diagnosis || notes || '').trim();

    if (!resolvedPatientName || !resolvedDiagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and diagnosis are required.'
      });
    }

    // Parse medicines if passed as comma-separated string or array
    let parsedMedicines = [];
    if (Array.isArray(medicines)) {
      parsedMedicines = medicines.map((m) => {
        if (typeof m === 'string') {
          return { name: m.trim(), dosage: '', duration: '', timing: '' };
        }
        return {
          name: m.name ? m.name.trim() : 'Medicine',
          dosage: m.dosage || '',
          duration: m.duration || '',
          timing: m.timing || ''
        };
      });
    } else if (typeof medicines === 'string') {
      parsedMedicines = medicines
        .split(',')
        .filter((s) => s.trim().length > 0)
        .map((name) => ({
          name: name.trim(),
          dosage: '',
          duration: '',
          timing: ''
        }));
    }

    // Auto-link patient if exists
    let resolvedPatientId = patientId;
    if (!resolvedPatientId) {
      const patient = await Patient.findOne({ name: resolvedPatientName });
      if (patient) resolvedPatientId = patient._id;
    }

    const prescription = await Prescription.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatientId,
      patientName: resolvedPatientName,
      doctorName: (doctorName || 'Dr. Self').trim(),
      diagnosis: resolvedDiagnosis,
      tag: tag || resolvedDiagnosis,
      medicines: parsedMedicines,
      instructions: instructions || '',
      status: status || 'Active',
      followUpDate: followUpDate || ''
    });

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all prescriptions with filters & search
// @route   GET /api/prescriptions
// @access  Public / Protected
const getAllPrescriptions = async (req, res, next) => {
  try {
    const { q, filter, status } = req.query;

    const queryObj = {};

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      queryObj.$or = [
        { patientName: regex },
        { doctorName: regex },
        { diagnosis: regex },
        { 'medicines.name': regex }
      ];
    }

    if (status && status !== 'All') {
      queryObj.status = status;
    }

    // Timeframe filters: "Today", "This Week", "This Month"
    if (filter) {
      const now = new Date();
      if (filter === 'Today') {
        const start = new Date(now.setHours(0, 0, 0, 0));
        const end = new Date(now.setHours(23, 59, 59, 999));
        queryObj.createdAt = { $gte: start, $lte: end };
      } else if (filter === 'This Week') {
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        firstDayOfWeek.setHours(0, 0, 0, 0);
        queryObj.createdAt = { $gte: firstDayOfWeek };
      } else if (filter === 'This Month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        queryObj.createdAt = { $gte: firstDayOfMonth };
      }
    }

    const prescriptions = await Prescription.find(queryObj).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Public / Protected
const getPrescriptionById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Public / Protected
const updatePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Prescription updated successfully',
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Public / Protected
const deletePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findByIdAndDelete(req.params.id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionById,
  updatePrescription,
  deletePrescription
};

export default {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionById,
  updatePrescription,
  deletePrescription
};
