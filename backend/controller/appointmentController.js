import Appointment from '../model/Appointment.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// Helper to normalize status across Flutter client variants
const normalizeStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Scheduled';
  const s = status.trim().toLowerCase();
  if (s === 'booked' || s === 'pending') return 'Scheduled';
  if (s === 'scheduled') return 'Scheduled';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'checked in' || s === 'checkedin') return 'Checked In';
  if (s === 'engaged') return 'Engaged';
  if (s === 'completed') return 'Completed';
  if (s === 'missed') return 'Missed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  return status.trim();
};

// Helper to auto-update past scheduled appointments to Missed scoped to doctor
const autoCheckMissed = async (userId) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const query = {
      appointmentDate: { $lt: todayStr },
      status: { $in: ['Scheduled', 'Confirmed', 'Booked', 'Pending'] }
    };
    if (userId) {
      query.user = userId;
    }
    await Appointment.updateMany(query, { $set: { status: 'Missed' } });
  } catch (err) {
    console.error('Auto check missed appointments error:', err.message);
  }
};

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Protected
const createAppointment = async (req, res, next) => {
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
      visitType,
      appointmentDate,
      date,
      appointmentTime,
      time,
      notes,
      status,
      gender
    } = req.body;

    let resolvedPatientName = (patientName || name || '').trim();
    let resolvedPhone = (phoneNumber || mobileNumber || phone || '').trim();
    const resolvedDate = (appointmentDate || date || '').trim();
    const resolvedTime = (appointmentTime || time || '').trim();

    const targetPatientId = patientId || patientInputId;
    let resolvedPatient = null;

    // 1. If patientId is provided, find patient by ID scoped to current doctor
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

      // Populate missing fields from patient record
      if (!resolvedPatientName) resolvedPatientName = resolvedPatient.name;
      if (!resolvedPhone) resolvedPhone = resolvedPatient.mobileNumber;
    } else {
      // 2. No patientId provided: find existing patient for this doctor or auto-create
      if (!resolvedPatientName || !resolvedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Patient name and phone number (or a valid patientId) are required.'
        });
      }

      const doctorQuery = getDoctorFilter(req);
      resolvedPatient = await Patient.findOne({
        ...doctorQuery,
        $or: [
          { name: resolvedPatientName },
          { mobileNumber: resolvedPhone }
        ]
      });

      if (!resolvedPatient) {
        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: resolvedPatientName,
          mobileNumber: resolvedPhone,
          dob: '2000-01-01',
          gender: gender || 'Male'
        });
      }
    }

    if (!resolvedDate || !resolvedTime) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date and time slot are required.'
      });
    }

    const appointment = await Appointment.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient._id,
      patientName: resolvedPatientName,
      phoneNumber: resolvedPhone,
      department: department || 'Dental',
      doctorName: (doctorName || doctor || req.user?.name || 'Dr. Self').trim(),
      visitType: visitType || 'Consultation',
      appointmentDate: resolvedDate,
      appointmentTime: resolvedTime,
      notes: (notes || '').trim(),
      status: normalizeStatus(status),
      gender: gender || (resolvedPatient.gender === 'Female' ? 'F' : 'M')
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all appointments with filters (isolated by doctor)
// @route   GET /api/appointments
// @access  Protected
const getAllAppointments = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    await autoCheckMissed(userId);

    const { date, status, department, doctorName, patientId, q } = req.query;

    const filter = getDoctorFilter(req);

    if (patientId && isValidObjectId(patientId)) {
      filter.patient = patientId;
    }

    if (date) {
      filter.appointmentDate = date;
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'All') {
      filter.status = new RegExp(`^${escapeRegex(status.trim())}$`, 'i');
    }

    if (department && typeof department === 'string' && department.trim()) {
      filter.department = department.trim();
    }

    if (doctorName && typeof doctorName === 'string' && doctorName.trim()) {
      filter.doctorName = new RegExp(escapeRegex(doctorName.trim()), 'i');
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { patientName: regex },
          { phoneNumber: regex },
          { notes: regex }
        ]
      });
    }

    const appointments = await Appointment.find(filter)
      .populate('patient')
      .sort({ appointmentDate: 1, appointmentTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's appointments for current doctor
// @route   GET /api/appointments/today
// @access  Protected
const getTodaysAppointments = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const filter = {
      ...getDoctorFilter(req),
      appointmentDate: todayStr
    };

    const appointments = await Appointment.find(filter)
      .populate('patient')
      .sort({ appointmentTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      date: todayStr,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get missed appointments for current doctor
// @route   GET /api/appointments/missed
// @access  Protected
const getMissedAppointments = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    await autoCheckMissed(userId);

    const filter = {
      ...getDoctorFilter(req),
      status: 'Missed'
    };

    const appointments = await Appointment.find(filter)
      .populate('patient')
      .sort({ appointmentDate: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update appointment status
// @route   PATCH /api/appointments/:id/status
// @access  Protected
const updateAppointmentStatus = async (req, res, next) => {
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
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment || !isOwnerOrAdmin(req, appointment)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const normalizedStatus = normalizeStatus(status);
    appointment.status = normalizedStatus;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${normalizedStatus}`,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get appointment by ID
// @route   GET /api/appointments/:id
// @access  Protected
const getAppointmentById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findById(req.params.id).populate('patient');

    if (!appointment || !isOwnerOrAdmin(req, appointment)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update appointment details
// @route   PUT /api/appointments/:id or PATCH /api/appointments/:id
// @access  Protected
const updateAppointment = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment || !isOwnerOrAdmin(req, appointment)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

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
      visitType,
      appointmentDate,
      date,
      appointmentTime,
      time,
      notes,
      status,
      gender
    } = req.body;

    const targetPatientId = patientId || patientInputId;
    if (targetPatientId) {
      if (!isValidObjectId(targetPatientId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid patient ID format: ${targetPatientId}`
        });
      }
      const patientDoc = await Patient.findById(targetPatientId);
      if (!patientDoc || !isOwnerOrAdmin(req, patientDoc)) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }
      appointment.patient = patientDoc._id;
      if (!patientName && !name) appointment.patientName = patientDoc.name;
      if (!phoneNumber && !mobileNumber && !phone) appointment.phoneNumber = patientDoc.mobileNumber;
    }

    if (patientName || name) appointment.patientName = (patientName || name).trim();
    if (phoneNumber || mobileNumber || phone) appointment.phoneNumber = (phoneNumber || mobileNumber || phone).trim();
    if (department) appointment.department = department.trim();
    if (doctorName || doctor) appointment.doctorName = (doctorName || doctor).trim();
    if (visitType) appointment.visitType = visitType.trim();
    if (appointmentDate || date) appointment.appointmentDate = (appointmentDate || date).trim();
    if (appointmentTime || time) appointment.appointmentTime = (appointmentTime || time).trim();
    if (status) appointment.status = normalizeStatus(status);
    if (notes !== undefined) appointment.notes = String(notes).trim();
    if (gender) appointment.gender = gender;

    await appointment.save();
    await appointment.populate('patient');

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Protected
const deleteAppointment = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment || !isOwnerOrAdmin(req, appointment)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await appointment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled and removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createAppointment,
  getAllAppointments,
  getTodaysAppointments,
  getMissedAppointments,
  updateAppointment,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
};

export default {
  createAppointment,
  getAllAppointments,
  getTodaysAppointments,
  getMissedAppointments,
  updateAppointment,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
};
