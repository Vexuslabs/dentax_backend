import Report from '../model/Report.js';
import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Bill from '../model/Bill.js';
import Appointment from '../model/Appointment.js';
import Prescription from '../model/Prescription.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Get all saved reports (doctor-isolated)
// @route   GET /api/reports/saved
// @access  Protected
const getAllSavedReports = async (req, res, next) => {
  try {
    const filter = getDoctorFilter(req);
    const reports = await Report.find(filter).sort({ createdAt: -1 });

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
// @access  Protected
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

// @desc    Generate dynamic report on-the-fly (doctor-isolated)
// @route   GET & POST /api/reports/generate
// @access  Protected
const generateReport = async (req, res, next) => {
  try {
    const title = req.body?.title || req.query?.title || '';
    const type = req.body?.type || req.query?.type || '';
    const fromDate = req.body?.fromDate || req.query?.fromDate;
    const toDate = req.body?.toDate || req.query?.toDate;

    const reportTitle = (title || type || 'Payment Summary Report').trim();
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const userMatch = req.user && req.user.role !== 'Admin'
      ? { user: req.user._id }
      : {};

    const dateFilter = { ...userMatch, createdAt: { $gte: from, $lte: to } };
    const doctorScope = getDoctorFilter(req);

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
        const visits = await PatientVisit.find({
          ...doctorScope,
          visitDate: { $gte: from, $lte: to }
        });
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
          { $match: { ...userMatch, visitDate: { $gte: from, $lte: to } } },
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
        const allPatients = await Patient.find(doctorScope);
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
          ...doctorScope,
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

      case 'Prescription Report':
      case 'Prescription Wise Report':
      case 'Prescription Summary Report':
      case 'Medicine Report':
      case 'Medicine Wise Report':
      case 'Medicines Report': {
        const prescriptions = await Prescription.find({
          ...doctorScope,
          createdAt: { $gte: from, $lte: to }
        }).populate('patient').sort({ createdAt: -1 });

        const medicineFrequency = {};
        const allMedicines = [];

        prescriptions.forEach((p) => {
          const pDate = p.createdAt;
          const patientId = p.patient?._id || p.patient;
          const patientName = p.patient?.name || p.patientName;

          (p.medicines || []).forEach((m) => {
            const medName = m.name || 'Unknown';
            if (!medicineFrequency[medName]) {
              medicineFrequency[medName] = {
                name: medName,
                count: 0,
                dosages: new Set(),
                timings: new Set()
              };
            }
            medicineFrequency[medName].count += 1;
            if (m.dosage) medicineFrequency[medName].dosages.add(m.dosage);
            if (m.timing) medicineFrequency[medName].timings.add(m.timing);

            allMedicines.push({
              prescriptionId: p._id,
              patientId,
              patientName,
              doctorName: p.doctorName,
              diagnosis: p.diagnosis,
              name: m.name,
              dosage: m.dosage || '',
              duration: m.duration || '',
              timing: m.timing || '',
              date: pDate
            });
          });
        });

        generatedData = {
          title: reportTitle,
          period: { from, to },
          totalPrescriptions: prescriptions.length,
          totalMedicinesPrescribed: allMedicines.length,
          uniqueMedicinesCount: Object.keys(medicineFrequency).length,
          topMedicines: Object.values(medicineFrequency)
            .sort((a, b) => b.count - a.count)
            .map((m) => ({
              name: m.name,
              count: m.count,
              dosages: Array.from(m.dosages),
              timings: Array.from(m.timings)
            })),
          prescriptions: prescriptions.map((p) => ({
            id: p._id,
            patientName: p.patient?.name || p.patientName,
            doctorName: p.doctorName,
            diagnosis: p.diagnosis,
            date: p.createdAt,
            medicines: p.medicines || [],
            medicinesCount: (p.medicines || []).length
          })),
          medicines: allMedicines
        };
        break;
      }

      default: {
        const lowerTitle = reportTitle.toLowerCase();
        if (lowerTitle.includes('prescript') || lowerTitle.includes('medicin')) {
          const prescriptions = await Prescription.find({
            ...doctorScope,
            createdAt: { $gte: from, $lte: to }
          }).populate('patient').sort({ createdAt: -1 });

          const allMedicines = [];
          prescriptions.forEach((p) => {
            (p.medicines || []).forEach((m) => {
              allMedicines.push({
                prescriptionId: p._id,
                patientId: p.patient?._id || p.patient,
                patientName: p.patient?.name || p.patientName,
                doctorName: p.doctorName,
                diagnosis: p.diagnosis,
                name: m.name,
                dosage: m.dosage || '',
                duration: m.duration || '',
                timing: m.timing || '',
                date: p.createdAt
              });
            });
          });

          generatedData = {
            title: reportTitle,
            period: { from, to },
            totalPrescriptions: prescriptions.length,
            totalMedicinesPrescribed: allMedicines.length,
            prescriptions: prescriptions.map((p) => ({
              id: p._id,
              patientName: p.patient?.name || p.patientName,
              doctorName: p.doctorName,
              diagnosis: p.diagnosis,
              date: p.createdAt,
              medicines: p.medicines || [],
              medicinesCount: (p.medicines || []).length
            })),
            medicines: allMedicines
          };
        } else {
          generatedData = {
            title: reportTitle,
            period: { from, to },
            message: `Analytics compiled for ${reportTitle}`
          };
        }
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

// @desc    Search patients for Report Center dropdown autocomplete (doctor-isolated)
// @route   GET /api/reports/search and GET /api/reports/patients
// @access  Protected
const searchPatientsForReport = async (req, res, next) => {
  try {
    const { q, query, name, search } = req.query;
    const searchTerm = (q || query || name || search || '').trim();
    const doctorFilter = getDoctorFilter(req);

    let queryCondition = { ...doctorFilter };

    if (searchTerm) {
      const regex = new RegExp(escapeRegex(searchTerm), 'i');
      queryCondition.$or = [
        { name: regex },
        { mobileNumber: regex },
        { 'personalInfo.adharNumber': regex }
      ];
    }

    const patients = await Patient.find(queryCondition)
      .sort({ name: 1 })
      .limit(25);

    const formattedData = patients.map((p) => ({
      _id: p._id,
      id: p._id,
      patientId: p._id,
      name: p.name,
      patientName: p.name,
      mobileNumber: p.mobileNumber,
      phone: p.mobileNumber,
      phoneNumber: p.mobileNumber,
      dob: p.dob || '',
      dateOfBirth: p.dob || '',
      age: p.age || 0,
      gender: p.gender || 'Other',
      sex: p.gender || 'Other',
      address: p.personalInfo?.address?.street || '',
      adharNumber: p.personalInfo?.adharNumber || '',
      medicalConditions: (p.medicalDetails?.conditions || []).map((c) => (c.name ? c.name : c))
    }));

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complete patient dossier / auto-fill document (ID or Name based)
// @route   GET /api/reports/patient-dossier/:patientId, GET /api/reports/auto-fill/:patientId, GET /api/reports/patient/:patientId
// @access  Protected
const getPatientDossier = async (req, res, next) => {
  try {
    const rawId = req.params.patientId || req.params.id || req.query.patientId || req.query.id || req.query.name || req.query.q;

    if (!rawId || (typeof rawId === 'string' && !rawId.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID or Name is required'
      });
    }

    const patientQuery = String(rawId).trim();
    let patient = null;

    if (isValidObjectId(patientQuery)) {
      patient = await Patient.findById(patientQuery);
    }

    const doctorScope = getDoctorFilter(req);

    // If not found by ID, lookup by patient name or mobile number
    if (!patient) {
      patient = await Patient.findOne({
        ...doctorScope,
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(patientQuery)}$`, 'i') } },
          { mobileNumber: patientQuery }
        ]
      });
    }

    if (!patient || !isOwnerOrAdmin(req, patient)) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const [visits, bills, appointments, prescriptions] = await Promise.all([
      PatientVisit.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ visitDate: -1, createdAt: -1 }),
      Bill.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ createdAt: -1 }),
      Appointment.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ appointmentDate: -1 }),
      Prescription.find({
        ...doctorScope,
        $or: [{ patient: patient._id }, { patientName: patient.name }]
      }).sort({ createdAt: -1 })
    ]);

    // Financial calculations
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    bills.forEach((b) => {
      const amt = Number(b.totalAmount) || 0;
      totalBilled += amt;
      if (b.status === 'Paid') {
        totalPaid += amt;
      } else if (b.status === 'Partially Paid') {
        const paidPart = Number(b.paidAmount) || 0;
        totalPaid += paidPart;
        totalOutstanding += Math.max(0, amt - paidPart);
      } else {
        totalOutstanding += amt;
      }
    });

    const medicalConditionsList = (patient.medicalDetails?.conditions || []).map((c) => (c.name ? c.name : c));

    const dossier = {
      // Identifiers
      id: patient._id,
      _id: patient._id,
      patientId: patient._id,

      // Core Demographics
      name: patient.name,
      patientName: patient.name,
      phone: patient.mobileNumber,
      phoneNumber: patient.mobileNumber,
      mobileNumber: patient.mobileNumber,
      age: patient.age || 0,
      gender: patient.gender || 'Other',
      sex: patient.gender || 'Other',
      dob: patient.dob || '',
      dateOfBirth: patient.dob || '',

      // Contact & Identification Details
      address: patient.personalInfo?.address?.street || '',
      street: patient.personalInfo?.address?.street || '',
      adharNumber: patient.personalInfo?.adharNumber || '',
      aadhaar: patient.personalInfo?.adharNumber || '',
      emergencyContact: patient.personalInfo?.emergencyContact || { name: '', phoneNumber: '' },
      anniversary: patient.personalInfo?.anniversary || null,
      notes: patient.personalInfo?.notes || '',

      // Medical & Preferences
      medicalConditions: medicalConditionsList,
      conditions: medicalConditionsList,
      history: patient.personalInfo || {},
      personalInfo: patient.personalInfo || {},
      preferences: patient.preferences || { language: 'English', membership: 'Silver', group: 'Regular' },

      // Summary Statistics for auto-fill document headers
      summary: {
        totalVisits: visits.length,
        totalAppointments: appointments.length,
        totalBills: bills.length,
        totalPrescriptions: prescriptions.length,
        totalBilled,
        totalPaid,
        totalOutstanding,
        lastVisitDate: visits[0]?.visitDate || null,
        lastDoctor: visits[0]?.doctorName || appointments[0]?.doctorName || prescriptions[0]?.doctorName || null
      },

      // Clinical Records
      visits: visits.map((v) => ({
        id: v._id,
        _id: v._id,
        date: v.visitDate,
        visitDate: v.visitDate,
        doctor: v.doctorName,
        doctorName: v.doctorName,
        complaints: v.complaints,
        diagnosis: v.diagnosis,
        vitals: v.vitals,
        actualTreatment: v.actualTreatmentDone,
        treatmentSuggested: v.treatmentSuggested,
        followUpDate: v.followUpDate,
        advice: v.advice
      })),
      treatments: visits.flatMap((v) => v.treatmentSuggested?.treatments || []),
      payments: bills.map((b) => ({
        id: b._id,
        _id: b._id,
        invoiceNumber: b.invoiceNumber,
        amount: b.totalAmount,
        totalAmount: b.totalAmount,
        status: b.status,
        date: b.createdAt,
        createdAt: b.createdAt
      })),
      bills: bills.map((b) => ({
        id: b._id,
        _id: b._id,
        invoiceNumber: b.invoiceNumber,
        amount: b.totalAmount,
        status: b.status,
        date: b.createdAt
      })),
      appointments: appointments.map((a) => ({
        id: a._id,
        _id: a._id,
        date: a.appointmentDate,
        appointmentDate: a.appointmentDate,
        time: a.appointmentTime,
        appointmentTime: a.appointmentTime,
        doctorName: a.doctorName,
        status: a.status
      })),
      prescriptions: prescriptions.map((p) => ({
        id: p._id,
        _id: p._id,
        date: p.createdAt,
        doctor: p.doctorName,
        doctorName: p.doctorName,
        diagnosis: p.diagnosis,
        status: p.status,
        medicines: p.medicines || [],
        instructions: p.instructions,
        followUpDate: p.followUpDate
      })),
      medicines: prescriptions.flatMap((p) => (p.medicines || []).map((m) => ({
        prescriptionId: p._id,
        prescriptionDate: p.createdAt,
        diagnosis: p.diagnosis,
        doctor: p.doctorName,
        doctorName: p.doctorName,
        name: m.name,
        dosage: m.dosage || m.dose || '',
        dose: m.dose || m.dosage || '',
        duration: m.duration || '',
        timing: m.timing || ''
      })))
    };

    res.status(200).json({
      success: true,
      data: dossier,
      autoFillData: dossier
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllSavedReports,
  saveReport,
  generateReport,
  searchPatientsForReport,
  getPatientDossier
};

export default {
  getAllSavedReports,
  saveReport,
  generateReport,
  searchPatientsForReport,
  getPatientDossier
};
