import PatientVisit from '../model/PatientVisit.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

// @desc    Create new patient visit
// @route   POST /api/visits
// @access  Public / Protected
const createVisit = async (req, res, next) => {
  try {
    const {
      patientId,
      patientName,
      doctorName,
      mobileNumber,
      visitDate,
      visitTime,
      isNewPatient,
      status,
      complaints,
      treatmentSuggested,
      observations,
      diagnosis,
      vitals,
      advice,
      followUpDate,
      actualTreatmentDone
    } = req.body;

    if (!patientName) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required.'
      });
    }

    // Auto-link or create patient if not present
    let resolvedPatientId = patientId;
    if (!resolvedPatientId) {
      let patient = await Patient.findOne({
        $or: [
          { name: patientName.trim() },
          ...(mobileNumber ? [{ mobileNumber: mobileNumber.trim() }] : [])
        ]
      });

      if (!patient) {
        patient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: patientName.trim(),
          mobileNumber: mobileNumber ? mobileNumber.trim() : '0000000000',
          dob: '2000-01-01',
          gender: 'Male'
        });
      }
      resolvedPatientId = patient._id;
    }

    const visit = await PatientVisit.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatientId,
      patientName: patientName.trim(),
      doctorName: doctorName ? doctorName.trim() : 'Dr. Self',
      mobileNumber: mobileNumber ? mobileNumber.trim() : '',
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      visitTime: visitTime || '10:00',
      isNewPatient: isNewPatient || false,
      status: status || 'Completed',
      complaints: complaints || [],
      treatmentSuggested: treatmentSuggested || { fees: 0, discount: 0, total: 0, treatments: [], medicines: [] },
      observations: observations || [],
      diagnosis: diagnosis || [],
      vitals: vitals || { bp: '120/80', pulse: '72', temp: '98.6' },
      advice: advice || '',
      followUpDate: followUpDate || '',
      actualTreatmentDone: actualTreatmentDone || ''
    });

    res.status(201).json({
      success: true,
      message: 'Patient visit recorded successfully',
      data: visit
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all visits
// @route   GET /api/visits
// @access  Public / Protected
const getAllVisits = async (req, res, next) => {
  try {
    const { patientId, patientName, doctorName, date, startDate, endDate } = req.query;

    const filter = {};

    if (patientId && isValidObjectId(patientId)) filter.patient = patientId;
    if (patientName && typeof patientName === 'string' && patientName.trim()) {
      filter.patientName = new RegExp(escapeRegex(patientName.trim()), 'i');
    }
    if (doctorName && typeof doctorName === 'string' && doctorName.trim()) {
      filter.doctorName = new RegExp(escapeRegex(doctorName.trim()), 'i');
    }

    if (date) {
      const d = new Date(date);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      filter.visitDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate || endDate) {
      filter.visitDate = {};
      if (startDate) filter.visitDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.visitDate.$lte = end;
      }
    }

    const visits = await PatientVisit.find(filter).sort({ visitDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: visits.length,
      data: visits
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get visit by ID
// @route   GET /api/visits/:id
// @access  Public / Protected
const getVisitById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    res.status(200).json({
      success: true,
      data: visit
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update visit
// @route   PUT /api/visits/:id
// @access  Public / Protected
const updateVisit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Visit updated successfully',
      data: visit
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete visit
// @route   DELETE /api/visits/:id
// @access  Public / Protected
const deleteVisit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findByIdAndDelete(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Visit deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createVisit,
  getAllVisits,
  getVisitById,
  updateVisit,
  deleteVisit
};

export default {
  createVisit,
  getAllVisits,
  getVisitById,
  updateVisit,
  deleteVisit
};
