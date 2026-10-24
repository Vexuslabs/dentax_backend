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

// Helper to parse any incoming date format (YYYY-MM-DD, ISO, DD-MM-YYYY, timestamps, Date objects)
// into a strict, canonical YYYY-MM-DD format preserving the intended calendar date.
const parseDateToCanonical = (inputDate) => {
  if (!inputDate) return '';
  if (inputDate instanceof Date) {
    if (isNaN(inputDate.getTime())) return '';
    const y = inputDate.getFullYear();
    const m = String(inputDate.getMonth() + 1).padStart(2, '0');
    const d = String(inputDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(inputDate).trim();
  if (!str) return '';

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-11-20 or 2026-11-20T...)
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Matches DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    let day = Number(dmyMatch[1]);
    let month = Number(dmyMatch[2]);
    const year = dmyMatch[3];
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. Fallback to Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
};

// Helper to normalize gender dynamically
const normalizeGender = (val) => {
  if (!val) return '';
  const s = String(val).trim().toLowerCase();
  if (s === 'f' || s === 'female') return 'Female';
  if (s === 'm' || s === 'male') return 'Male';
  if (s === 'other' || s === 'o') return 'Other';
  return val;
};

// Helper to auto-update past scheduled appointments to Missed scoped to doctor
const autoCheckMissed = async (userId) => {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

    const inputPatientName = (patientName || name || '').trim();
    const inputPhone = (phoneNumber || mobileNumber || phone || '').trim();
    
    // Dynamically resolve gender from request without hardcoding
    let resolvedGender = normalizeGender(gender || req.body.sex);

    // Dynamically parse and normalize date preserving next month/future dates
    const rawDateInput = appointmentDate || req.body.appointment_date || date || req.body.selectedDate || req.body.bookingDate || req.body.scheduledDate || req.body.dateTime || req.body.datetime;
    const resolvedDate = parseDateToCanonical(rawDateInput);
    const resolvedTime = (appointmentTime || req.body.appointment_time || time || '10:00 AM').trim();

    const targetPatientId = patientId || patientInputId || req.body?.patient_id;
    const doctorQuery = getDoctorFilter(req);
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

      // If client provided a different patientName, avoid hijacking into target patient
      if (inputPatientName && inputPatientName.toLowerCase() !== resolvedPatient.name.toLowerCase()) {
        const nameMatch = await Patient.findOne({
          ...doctorQuery,
          name: new RegExp(`^${escapeRegex(inputPatientName)}$`, 'i')
        });

        if (nameMatch) {
          resolvedPatient = nameMatch;
        } else {
          const dynamicDob = req.body.dob ? parseDateToCanonical(req.body.dob) : (req.body.age ? `${new Date().getFullYear() - Number(req.body.age)}-01-01` : '');
          resolvedPatient = await Patient.create({
            user: req.user ? req.user.id : null,
            name: inputPatientName,
            mobileNumber: inputPhone || resolvedPatient.mobileNumber || '0000000000',
            dob: dynamicDob || '1995-01-01',
            gender: resolvedGender || 'Other',
            age: Number(req.body.age) || 0
          });
        }
      }
    } else {
      if (!inputPatientName && !inputPhone) {
        return res.status(400).json({
          success: false,
          message: 'Patient name and phone number (or a valid patientId) are required.'
        });
      }

      if (inputPatientName && inputPhone) {
        resolvedPatient = await Patient.findOne({
          ...doctorQuery,
          name: new RegExp(`^${escapeRegex(inputPatientName)}$`, 'i'),
          mobileNumber: inputPhone
        });
      }

      if (!resolvedPatient && inputPatientName) {
        resolvedPatient = await Patient.findOne({
          ...doctorQuery,
          name: new RegExp(`^${escapeRegex(inputPatientName)}$`, 'i')
        });
      }

      if (!resolvedPatient) {
        if (!inputPatientName) {
          return res.status(400).json({
            success: false,
            message: 'Patient name is required.'
          });
        }
        const dynamicDob = req.body.dob ? parseDateToCanonical(req.body.dob) : (req.body.age ? `${new Date().getFullYear() - Number(req.body.age)}-01-01` : '');
        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: inputPatientName,
          mobileNumber: inputPhone || '0000000000',
          dob: dynamicDob || '1995-01-01',
          gender: resolvedGender || 'Other',
          age: Number(req.body.age) || 0
        });
      }
    }

    const finalPatientName = resolvedPatient.name;
    const finalPhone = resolvedPatient.mobileNumber || inputPhone;
    if (!resolvedGender && resolvedPatient.gender) {
      resolvedGender = normalizeGender(resolvedPatient.gender);
    }

    if (!resolvedDate) {
      return res.status(400).json({
        success: false,
        message: 'Appointment date is required.'
      });
    }

    const appointment = await Appointment.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient._id,
      patientName: finalPatientName,
      phoneNumber: finalPhone,
      department: department || 'Dental',
      doctorName: (doctorName || doctor || req.user?.name || 'Dr. Self').trim(),
      visitType: visitType || 'Consultation',
      appointmentDate: resolvedDate,
      appointmentTime: resolvedTime,
      notes: (notes || '').trim(),
      status: normalizeStatus(status),
      gender: resolvedGender || normalizeGender(resolvedPatient.gender) || 'Other'
    });

    await appointment.populate('patient');

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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { date, status, department, doctorName, q, startDate, endDate, month, type, filter: filterParam } = req.query;
    const rawPatientId = req.query.patientId || req.query.patient || req.query.patient_id;

    const filter = getDoctorFilter(req);

    if (rawPatientId && isValidObjectId(rawPatientId)) {
      filter.patient = rawPatientId;
    }

    const isUpcoming = req.query.upcoming === 'true' ||
      type === 'upcoming' ||
      filterParam === 'upcoming' ||
      status?.toLowerCase() === 'upcoming' ||
      date?.toLowerCase() === 'upcoming' ||
      req.query.tab?.toLowerCase() === 'upcoming';

    if (isUpcoming) {
      filter.appointmentDate = { $gte: todayStr };
      filter.status = { $nin: ['Cancelled', 'Missed'] };
    } else if (date) {
      filter.appointmentDate = parseDateToCanonical(date);
    } else if (startDate || endDate || req.query.from || req.query.to) {
      const fromStr = parseDateToCanonical(startDate || req.query.from);
      const toStr = parseDateToCanonical(endDate || req.query.to);
      filter.appointmentDate = {};
      if (fromStr) filter.appointmentDate.$gte = fromStr;
      if (toStr) filter.appointmentDate.$lte = toStr;
    } else if (month) {
      const m = String(month).trim();
      const regex = m.includes('-') ? new RegExp(`^${escapeRegex(m)}`) : new RegExp(`^\\d{4}-${escapeRegex(m.padStart(2, '0'))}`);
      filter.appointmentDate = regex;
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'All' && status.toLowerCase() !== 'upcoming') {
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

// @desc    Get upcoming appointments (today and all future dates, including next month)
// @route   GET /api/appointments/upcoming
// @access  Protected
const getUpcomingAppointments = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    await autoCheckMissed(userId);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const rawPatientId = req.query.patientId || req.query.patient || req.query.patient_id;

    const filter = {
      ...getDoctorFilter(req),
      appointmentDate: { $gte: todayStr }
    };

    if (rawPatientId && isValidObjectId(rawPatientId)) {
      filter.patient = rawPatientId;
    }

    if (req.query.status && req.query.status !== 'All' && req.query.status.toLowerCase() !== 'upcoming') {
      filter.status = new RegExp(`^${escapeRegex(req.query.status.trim())}$`, 'i');
    } else {
      filter.status = { $nin: ['Cancelled', 'Missed'] };
    }

    const appointments = await Appointment.find(filter)
      .populate('patient')
      .sort({ appointmentDate: 1, appointmentTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      today: todayStr,
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
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
      // Dynamically fetch patient details and contact number from database record
      appointment.patientName = patientDoc.name;
      appointment.phoneNumber = patientDoc.mobileNumber;
      if (patientDoc.gender) appointment.gender = patientDoc.gender === 'Female' ? 'F' : 'M';
    } else {
      if (patientName || name) appointment.patientName = (patientName || name).trim();
      if (phoneNumber || mobileNumber || phone) appointment.phoneNumber = (phoneNumber || mobileNumber || phone).trim();
    }

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
  getUpcomingAppointments,
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
  getUpcomingAppointments,
  getTodaysAppointments,
  getMissedAppointments,
  updateAppointment,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
};
