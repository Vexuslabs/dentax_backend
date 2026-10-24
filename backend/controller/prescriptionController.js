import Prescription from '../model/Prescription.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Create new prescription
// @route   POST /api/prescriptions
// @access  Protected
const createPrescription = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      doctorName,
      diagnosis,
      notes,
      tag,
      medicines,
      instructions,
      status,
      followUpDate
    } = req.body;

    let resolvedPatientName = (patientName || name || '').trim();
    const resolvedDiagnosis = (diagnosis || notes || '').trim();

    const targetPatientId = patientId || patientInputId;
    let resolvedPatient = null;

    if (targetPatientId) {
      if (!isValidObjectId(targetPatientId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid patient ID format: ${targetPatientId}`
        });
      }

      resolvedPatient = await Patient.findById(targetPatientId);
      if (!resolvedPatient || !isOwnerOrAdmin(req, resolvedPatient)) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found or not authorized to access this patient.'
        });
      }

      if (!resolvedPatientName) resolvedPatientName = resolvedPatient.name;
    } else {
      if (!resolvedPatientName) {
        return res.status(400).json({
          success: false,
          message: 'Patient name or valid patientId is required.'
        });
      }

      const doctorQuery = getDoctorFilter(req);
      resolvedPatient = await Patient.findOne({
        ...doctorQuery,
        name: resolvedPatientName
      });
    }

    if (!resolvedDiagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Diagnosis is required.'
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
        .map((nameStr) => ({
          name: nameStr.trim(),
          dosage: '',
          duration: '',
          timing: ''
        }));
    }

    const prescription = await Prescription.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      patientName: resolvedPatientName,
      doctorName: (doctorName || req.user?.name || 'Dr. Self').trim(),
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

// @desc    Get all prescriptions with filters & search (doctor-isolated)
// @route   GET /api/prescriptions
// @access  Protected
const getAllPrescriptions = async (req, res, next) => {
  try {
    const { q, filter, status, patientId } = req.query;

    const queryObj = getDoctorFilter(req);

    if (patientId && isValidObjectId(patientId)) {
      queryObj.patient = patientId;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      queryObj.$and = queryObj.$and || [];
      queryObj.$and.push({
        $or: [
          { patientName: regex },
          { doctorName: regex },
          { diagnosis: regex },
          { 'medicines.name': regex }
        ]
      });
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

    const prescriptions = await Prescription.find(queryObj)
      .populate('patient')
      .sort({ createdAt: -1 });

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
// @access  Protected
const getPrescriptionById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id).populate('patient');

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
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
// @access  Protected
const updatePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const updateData = { ...req.body };
    delete updateData.user;

    const { patientId, patient: patientInputId } = req.body;
    const targetPatientId = patientId || patientInputId;
    if (targetPatientId && isValidObjectId(targetPatientId)) {
      const patientDoc = await Patient.findById(targetPatientId);
      if (patientDoc && isOwnerOrAdmin(req, patientDoc)) {
        updateData.patient = patientDoc._id;
      }
    }

    const updatedPrescription = await Prescription.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('patient');

    res.status(200).json({
      success: true,
      message: 'Prescription updated successfully',
      data: updatedPrescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Protected
const deletePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    await prescription.deleteOne();

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
