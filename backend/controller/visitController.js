import PatientVisit from '../model/PatientVisit.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Create new patient visit
// @route   POST /api/visits
// @access  Protected
const createVisit = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      doctorName,
      mobileNumber,
      phone,
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

    let resolvedPatientName = (patientName || name || '').trim();
    let resolvedMobile = (mobileNumber || phone || '').trim();

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

      // Dynamically fetch patient details and contact numbers from the database record
      resolvedPatientName = resolvedPatient.name;
      resolvedMobile = resolvedPatient.mobileNumber;
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
        $or: [
          { name: resolvedPatientName },
          ...(resolvedMobile ? [{ mobileNumber: resolvedMobile }] : [])
        ]
      });

      if (!resolvedPatient) {
        const incomingGender = req.body.gender ? String(req.body.gender).trim().toLowerCase() : '';
        const resolvedGender = incomingGender === 'female' || incomingGender === 'f' ? 'Female'
          : incomingGender === 'male' || incomingGender === 'm' ? 'Male'
          : 'Other';
        const resolvedDob = req.body.dob ? String(req.body.dob).trim() : (req.body.age && Number(req.body.age) > 0 ? `${new Date().getFullYear() - Number(req.body.age)}-01-01` : '');

        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: resolvedPatientName,
          mobileNumber: resolvedMobile || '0000000000',
          dob: resolvedDob,
          gender: resolvedGender,
          age: Number(req.body.age) || 0
        });
      }
    }

    const visit = await PatientVisit.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      patientName: resolvedPatientName,
      doctorName: (doctorName || req.user?.name || 'Dr. Self').trim(),
      mobileNumber: resolvedMobile,
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

    await visit.populate('patient');

    res.status(201).json({
      success: true,
      message: 'Patient visit recorded successfully',
      data: visit
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all visits (doctor-isolated)
// @route   GET /api/visits
// @access  Protected
const getAllVisits = async (req, res, next) => {
  try {
    const { patientId, patientName, doctorName, date, startDate, endDate } = req.query;

    const filter = getDoctorFilter(req);

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

    const visits = await PatientVisit.find(filter)
      .populate('patient')
      .sort({ visitDate: -1, createdAt: -1 });

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
// @access  Protected
const getVisitById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findById(req.params.id).populate('patient');

    if (!visit || !isOwnerOrAdmin(req, visit)) {
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
// @access  Protected
const updateVisit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findById(req.params.id);

    if (!visit || !isOwnerOrAdmin(req, visit)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
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
        updateData.patientName = patientDoc.name;
        updateData.mobileNumber = patientDoc.mobileNumber;
      }
    }

    const updatedVisit = await PatientVisit.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('patient');

    res.status(200).json({
      success: true,
      message: 'Visit updated successfully',
      data: updatedVisit
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete visit
// @route   DELETE /api/visits/:id
// @access  Protected
const deleteVisit = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    const visit = await PatientVisit.findById(req.params.id);

    if (!visit || !isOwnerOrAdmin(req, visit)) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    await visit.deleteOne();

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
