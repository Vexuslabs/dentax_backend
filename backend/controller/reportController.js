import Report from '../model/Report.js';
import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Bill from '../model/Bill.js';
import Appointment from '../model/Appointment.js';
import { isValidObjectId } from '../utils/helpers.js';

// @desc    Get all saved reports
// @route   GET /api/reports/saved
// @access  Public / Protected
const getAllSavedReports = async (req, res, next) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save a generated report
// @route   POST /api/reports/save
// @access  Public / Protected
const saveReport = async (req, res, next) => {
  try {
    const { title, type, fromDate, toDate, data, reportData, generatedBy } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Report title is required.'
      });
    }

    const report = await Report.create({
      user: req.user ? req.user.id : null,
      title: title.trim(),
      type: type || 'General',
      fromDate: fromDate ? new Date(fromDate) : null,
      toDate: toDate ? new Date(toDate) : null,
      data: data || reportData || {},
      generatedBy: generatedBy || (req.user ? req.user.name : 'System')
    });

    res.status(201).json({
      success: true,
      message: 'Report saved successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate dynamic report on-the-fly
// @route   GET & POST /api/reports/generate
// @access  Public / Protected
const generateReport = async (req, res, next) => {
  try {
    const title = req.body?.title || req.query?.title || '';
    const type = req.body?.type || req.query?.type || '';
    const fromDate = req.body?.fromDate || req.query?.fromDate;
    const toDate = req.body?.toDate || req.query?.toDate;

    const reportTitle = (title || type || 'Payment Summary Report').trim();
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const dateFilter = { createdAt: { $gte: from, $lte: to } };

    let generatedData = {};

    switch (reportTitle) {
      case 'Payment Summary Report':
      case 'Clinic Wise Payment Report': {
        const [totalBills, paidBills, pendingBills] = await Promise.all([
          Bill.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
          ]),
          Bill.aggregate([
            { $match: { ...dateFilter, status: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
          ]),
          Bill.aggregate([
            { $match: { ...dateFilter, status: { $in: ['Pending', 'Partially Paid'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
          ])
        ]);

        const recentPayments = await Bill.find(dateFilter).sort({ createdAt: -1 }).limit(20);

        generatedData = {
          title: reportTitle,
          period: { from, to },
          summary: {
            totalBilled: totalBills[0]?.total || 0,
            totalBillsCount: totalBills[0]?.count || 0,
            totalCollected: paidBills[0]?.total || 0,
            paidBillsCount: paidBills[0]?.count || 0,
            totalOutstanding: pendingBills[0]?.total || 0,
            pendingBillsCount: pendingBills[0]?.count || 0
          },
          bills: recentPayments
        };
        break;
      }

      case 'Treatment Wise Report': {
        const visits = await PatientVisit.find({ visitDate: { $gte: from, $lte: to } });
        const treatmentCounts = {};
        let totalRevenue = 0;

        visits.forEach((v) => {
          const actual = v.actualTreatmentDone;
          if (actual && actual.trim()) {
            treatmentCounts[actual] = (treatmentCounts[actual] || 0) + 1;
          }
          if (v.treatmentSuggested?.treatments) {
            v.treatmentSuggested.treatments.forEach((t) => {
              treatmentCounts[t] = (treatmentCounts[t] || 0) + 1;
            });
          }
          totalRevenue += (v.treatmentSuggested?.total || 0);
        });

        generatedData = {
          title: reportTitle,
          period: { from, to },
          totalVisitsAnalyzed: visits.length,
          estimatedTreatmentRevenue: totalRevenue,
          treatmentBreakdown: Object.entries(treatmentCounts).map(([treatment, count]) => ({
            treatment,
            count
          }))
        };
        break;
      }

      case 'Doctor Wise Visit Report':
      case 'Doctor Wise Payment Report': {
        const doctorVisits = await PatientVisit.aggregate([
          { $match: { visitDate: { $gte: from, $lte: to } } },
          {
            $group: {
              _id: '$doctorName',
              visitCount: { $sum: 1 },
              revenue: { $sum: '$treatmentSuggested.total' }
            }
          }
        ]);

        generatedData = {
          title: reportTitle,
          period: { from, to },
          doctors: doctorVisits.map((d) => ({
            doctorName: d._id || 'Dr. Self',
            visits: d.visitCount,
            revenue: d.revenue
          }))
        };
        break;
      }

      case 'Birthday Report': {
        const allPatients = await Patient.find();
        const currentMonth = new Date().getMonth() + 1;

        const birthdayPatients = allPatients.filter((p) => {
          if (!p.dob) return false;
          try {
            const birthDate = new Date(p.dob);
            return birthDate.getMonth() + 1 === currentMonth;
          } catch (_) {
            return false;
          }
        });

        generatedData = {
          title: reportTitle,
          month: currentMonth,
          count: birthdayPatients.length,
          patients: birthdayPatients.map((p) => ({
            id: p._id,
            name: p.name,
            phone: p.mobileNumber,
            dob: p.dob,
            age: p.age
          }))
        };
        break;
      }

      case 'Follow-up Due Report': {
        const followUps = await PatientVisit.find({
          followUpDate: { $ne: '' }
        }).sort({ visitDate: -1 });

        generatedData = {
          title: reportTitle,
          count: followUps.length,
          followUps: followUps.map((v) => ({
            id: v._id,
            patientName: v.patientName,
            doctorName: v.doctorName,
            mobileNumber: v.mobileNumber,
            visitDate: v.visitDate,
            followUpDate: v.followUpDate,
            advice: v.advice
          }))
        };
        break;
      }

      default: {
        generatedData = {
          title: reportTitle,
          period: { from, to },
          message: `Analytics compiled for ${reportTitle}`
        };
        break;
      }
    }

    res.status(200).json({
      success: true,
      data: generatedData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complete patient dossier
// @route   GET /api/reports/patient-dossier/:patientId
// @access  Public / Protected
const getPatientDossier = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.patientId)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patient = await Patient.findById(req.params.patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const [visits, bills, appointments] = await Promise.all([
      PatientVisit.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }),
      Bill.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] }),
      Appointment.find({ $or: [{ patient: patient._id }, { patientName: patient.name }] })
    ]);

    const dossier = {
      id: patient._id,
      name: patient.name,
      phone: patient.mobileNumber,
      age: patient.age,
      gender: patient.gender,
      medicalConditions: patient.medicalDetails?.conditions || [],
      history: patient.personalInfo || {},
      visits: visits.map((v) => ({
        id: v._id,
        date: v.visitDate,
        doctor: v.doctorName,
        complaints: v.complaints,
        diagnosis: v.diagnosis,
        vitals: v.vitals,
        actualTreatment: v.actualTreatmentDone
      })),
      treatments: visits.flatMap((v) => v.treatmentSuggested?.treatments || []),
      payments: bills.map((b) => ({
        id: b._id,
        invoiceNumber: b.invoiceNumber,
        amount: b.totalAmount,
        status: b.status,
        date: b.createdAt
      })),
      appointments: appointments.map((a) => ({
        id: a._id,
        date: a.appointmentDate,
        time: a.appointmentTime,
        status: a.status
      }))
    };

    res.status(200).json({
      success: true,
      data: dossier
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllSavedReports,
  saveReport,
  generateReport,
  getPatientDossier
};

export default {
  getAllSavedReports,
  saveReport,
  generateReport,
  getPatientDossier
};
