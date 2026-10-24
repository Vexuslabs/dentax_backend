import Queue from '../model/Queue.js';
import Patient from '../model/Patient.js';
import { isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// Status normalizer helper
const normalizeQueueStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Waiting';
  const s = status.trim().toLowerCase();
  if (s === 'waiting') return 'Waiting';
  if (s === 'in-consultation' || s === 'in consultation' || s === 'engaged' || s === 'consulting') return 'In-Consultation';
  if (s === 'completed' || s === 'done') return 'Completed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  return status;
};

// @desc    Get today's walk-in queue (doctor-isolated)
// @route   GET /api/queue/today or GET /api/queue
// @access  Protected
const getTodaysQueue = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { status, date, doctorName, patientId } = req.query;

    const queryDate = date || todayStr;
    const filter = {
      ...getDoctorFilter(req),
      date: queryDate
    };

    if (patientId && isValidObjectId(patientId)) {
      filter.patient = patientId;
    }

    if (status && typeof status === 'string' && status.trim()) {
      filter.status = normalizeQueueStatus(status);
    }

    if (doctorName && typeof doctorName === 'string' && doctorName.trim()) {
      filter.doctorName = new RegExp(doctorName.trim(), 'i');
    }

    const queue = await Queue.find(filter).populate('patient').sort({ tokenNumber: 1 });

    const waitingCount = queue.filter((q) => q.status === 'Waiting').length;
    const inConsultationCount = queue.filter((q) => q.status === 'In-Consultation').length;
    const completedCount = queue.filter((q) => q.status === 'Completed').length;

    res.status(200).json({
      success: true,
      count: queue.length,
      date: queryDate,
      summary: {
        waiting: waitingCount,
        inConsultation: inConsultationCount,
        completed: completedCount
      },
      data: queue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Issue new token to walk-in patient (doctor-isolated, ID-linked)
// @route   POST /api/queue
// @access  Protected
const issueToken = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      phoneNumber,
      mobileNumber,
      phone,
      department,
      doctorName,
      doctor,
      notes,
      estimatedWaitMinutes,
      date
    } = req.body;

    let resolvedName = (patientName || name || '').trim();
    let resolvedPhone = (phoneNumber || mobileNumber || phone || '').trim();

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

      if (!resolvedName) resolvedName = resolvedPatient.name;
      if (!resolvedPhone) resolvedPhone = resolvedPatient.mobileNumber;
    } else {
      if (!resolvedName || !resolvedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Patient name and phone number (or a valid patientId) are required to issue a token.'
        });
      }

      const doctorQuery = getDoctorFilter(req);
      resolvedPatient = await Patient.findOne({
        ...doctorQuery,
        $or: [{ name: resolvedName }, { mobileNumber: resolvedPhone }]
      });

      if (!resolvedPatient) {
        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: resolvedName,
          mobileNumber: resolvedPhone,
          dob: '2000-01-01',
          gender: 'Male'
        });
      }
    }

    const todayStr = date || new Date().toISOString().split('T')[0];

    // Find highest token number for this doctor on this date
    const doctorScope = getDoctorFilter(req);
    const lastToken = await Queue.findOne({ ...doctorScope, date: todayStr }).sort({ tokenNumber: -1 });
    const nextTokenNumber = (lastToken?.tokenNumber || 0) + 1;

    const queueItem = await Queue.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient._id,
      tokenNumber: nextTokenNumber,
      patientName: resolvedName,
      phoneNumber: resolvedPhone,
      date: todayStr,
      department: department || 'Dental',
      doctorName: (doctorName || doctor || req.user?.name || 'Dr. Self').trim(),
      status: 'Waiting',
      estimatedWaitMinutes: Number(estimatedWaitMinutes) || 15,
      notes: (notes || '').trim()
    });

    res.status(201).json({
      success: true,
      message: `Token #${nextTokenNumber} issued successfully`,
      data: queueItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update walk-in queue status
// @route   PATCH /api/queue/:id/status
// @access  Protected
const updateQueueStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    const queueItem = await Queue.findById(req.params.id);

    if (!queueItem || !isOwnerOrAdmin(req, queueItem)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    const normalized = normalizeQueueStatus(status);
    queueItem.status = normalized;
    await queueItem.save();

    res.status(200).json({
      success: true,
      message: `Queue status updated to ${normalized}`,
      data: queueItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get queue item by ID
// @route   GET /api/queue/:id
// @access  Protected
const getQueueById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    const queueItem = await Queue.findById(req.params.id).populate('patient');

    if (!queueItem || !isOwnerOrAdmin(req, queueItem)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: queueItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete / Cancel queue entry
// @route   DELETE /api/queue/:id
// @access  Protected
const deleteQueueToken = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    const queueItem = await Queue.findById(req.params.id);

    if (!queueItem || !isOwnerOrAdmin(req, queueItem)) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found'
      });
    }

    await queueItem.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Queue entry removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  getTodaysQueue,
  issueToken,
  updateQueueStatus,
  getQueueById,
  deleteQueueToken
};

export default {
  getTodaysQueue,
  issueToken,
  updateQueueStatus,
  getQueueById,
  deleteQueueToken
};
