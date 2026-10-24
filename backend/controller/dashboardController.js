import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Appointment from '../model/Appointment.js';
import Bill from '../model/Bill.js';
import { escapeRegex } from '../utils/helpers.js';

// Helper to calculate date range bounds
const getDateRangeBounds = (rangeLabel, customStart, customEnd) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (rangeLabel) {
    case 'Today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'Tommorrow':
    case 'Tomorrow':
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      break;

    case 'Last 7 Days':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'Last Month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'Custom Range':
      if (customStart) start = new Date(customStart);
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
      break;

    case 'Last 30 Days':
    default:
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
};

// @desc    Get dashboard summary statistics & analytics
// @route   GET /api/dashboard/summary
// @access  Public / Protected
const getDashboardSummary = async (req, res, next) => {
  try {
    const { range, filter, startDate, endDate } = req.query;
    const rangeLabel = range || filter || 'Last 30 Days';

    const { start, end } = getDateRangeBounds(rangeLabel, startDate, endDate);
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      newPatientsCount,
      patientVisitsCount,
      appointmentsCount,
      missedAppointmentsCount,
      todaysAppointments,
      revenueSummary
    ] = await Promise.all([
      // New patients created in date range
      Patient.countDocuments({ createdAt: { $gte: start, $lte: end } }),

      // Patient visits conducted in date range
      PatientVisit.countDocuments({ visitDate: { $gte: start, $lte: end } }),

      // Total appointments in date range
      Appointment.countDocuments({
        appointmentDate: {
          $gte: start.toISOString().split('T')[0],
          $lte: end.toISOString().split('T')[0]
        }
      }),

      // Missed appointments
      Appointment.countDocuments({ status: 'Missed' }),

      // Today's scheduled appointments list
      Appointment.find({ appointmentDate: todayStr }).sort({ appointmentTime: 1 }),

      // Revenue aggregate for the period
      Bill.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, status: 'Paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        range: rangeLabel,
        period: { start, end },
        counts: {
          newPatients: newPatientsCount,
          patientVisits: patientVisitsCount,
          appointments: appointmentsCount,
          missedAppointments: missedAppointmentsCount
        },
        revenue: revenueSummary[0]?.totalRevenue || 0,
        todaysAppointments
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Global patient search for quick top bar
// @route   GET /api/dashboard/search
// @access  Public / Protected
const searchPatients = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const patients = await Patient.find({
      $or: [
        { name: regex },
        { mobileNumber: regex },
        { 'personalInfo.adharNumber': regex }
      ]
    }).limit(15);

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

export {
  getDashboardSummary,
  searchPatients
};

export default {
  getDashboardSummary,
  searchPatients
};
