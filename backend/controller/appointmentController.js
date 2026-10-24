import Appointment from '../model/Appointment.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

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

// Helper to auto-update past scheduled appointments to Missed
const autoCheckMissed = async () => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    await Appointment.updateMany(
      {
        appointmentDate: { $lt: todayStr },
        status: { $in: ['Scheduled', 'Confirmed', 'Booked'] }
      },
      {
        $set: { status: 'Missed' }
      }
    );
  } catch (err) {
    console.error('Auto check missed appointments error:', err.message);
  }
};

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Public / Protected
const createAppointment = async (req, res, next) => {
  try {
    const {
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

    const resolvedPatientName = (patientName || name || '').trim();
    const resolvedPhone = (phoneNumber || mobileNumber || phone || '').trim();
    const resolvedDate = (appointmentDate || date || '').trim();
    const resolvedTime = (appointmentTime || time || '').trim();

    if (!resolvedPatientName || !resolvedPhone || !resolvedDate || !resolvedTime) {
      return res.status(400).json({
        success: false,
        message: 'Patient name, phone number, date, and time slot are required.'
      });
    }

    // Auto-link or create patient record if new
    let patient = await Patient.findOne({
      $or: [
        { name: resolvedPatientName },
        { mobileNumber: resolvedPhone }
      ]
    });

    if (!patient) {
      patient = await Patient.create({
        user: req.user ? req.user.id : null,
        name: resolvedPatientName,
        mobileNumber: resolvedPhone,
        dob: '2000-01-01',
        gender: gender || 'Male'
      });
    }

    const appointment = await Appointment.create({
      user: req.user ? req.user.id : null,
      patient: patient._id,
      patientName: resolvedPatientName,
      phoneNumber: resolvedPhone,
      department: department || 'Dental',
      doctorName: (doctorName || doctor || 'Dr. Self').trim(),
      visitType: visitType || 'Consultation',
      appointmentDate: resolvedDate,
      appointmentTime: resolvedTime,
      notes: (notes || '').trim(),
      status: normalizeStatus(status),
      gender: gender || 'M'
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

// @desc    Get all appointments with filters
// @route   GET /api/appointments
// @access  Public / Protected
const getAllAppointments = async (req, res, next) => {
  try {
    // Run background check for missed appointments
    await autoCheckMissed();

    const { date, status, department, doctorName, q } = req.query;

    const filter = {};

    if (date) {
      filter.appointmentDate = date;
    }

    if (status && typeof status === 'string' && status.trim()) {
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
      filter.$or = [
        { patientName: regex },
        { phoneNumber: regex },
        { notes: regex }
      ];
    }

    const appointments = await Appointment.find(filter).sort({ appointmentDate: 1, appointmentTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's appointments
// @route   GET /api/appointments/today
// @access  Public / Protected
const getTodaysAppointments = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const appointments = await Appointment.find({
      appointmentDate: todayStr
    }).sort({ appointmentTime: 1 });

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

// @desc    Get missed appointments
// @route   GET /api/appointments/missed
// @access  Public / Protected
const getMissedAppointments = async (req, res, next) => {
  try {
    await autoCheckMissed();

    const appointments = await Appointment.find({
      status: 'Missed'
    }).sort({ appointmentDate: -1 });

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
// @access  Public / Protected
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

    const normalizedStatus = normalizeStatus(status);

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: normalizedStatus },
      { new: true, runValidators: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get appointment by ID
// @route   GET /api/appointments/:id
// @access  Public / Protected
const getAppointmentById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
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

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Public / Protected
const deleteAppointment = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

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
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
};

export default {
  createAppointment,
  getAllAppointments,
  getTodaysAppointments,
  getMissedAppointments,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
};
