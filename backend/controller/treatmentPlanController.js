import TreatmentPlan from '../model/TreatmentPlan.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// Helper to sanitize clinical notes inputs
const extractClinicalNotes = (body) => {
  const { clinicalNotes, complaint, observations, note, investigation, diagnosis } = body;
  return {
    complaint: (clinicalNotes?.complaint || complaint || '').trim(),
    observations: (clinicalNotes?.observations || observations || note || '').trim(),
    investigation: (clinicalNotes?.investigation || investigation || '').trim(),
    diagnosis: (clinicalNotes?.diagnosis || diagnosis || '').trim()
  };
};

// @desc    Submit / Create new treatment plan
// @route   POST /api/treatment-plans
// @access  Protected
const createTreatmentPlan = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      phoneNumber,
      phone,
      mobileNumber,
      treatment,
      treatments,
      fees,
      amount,
      discount,
      totalAmount,
      status,
      notes,
      date
    } = req.body;

    const targetPatientId = patientId || patientInputId;
    let resolvedPatient = null;
    let resolvedPatientName = (patientName || name || '').trim();
    let resolvedPhone = (phoneNumber || phone || mobileNumber || '').trim();

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

      // Dynamically fetch patient details from database record
      resolvedPatientName = resolvedPatient.name;
      resolvedPhone = resolvedPatient.mobileNumber;
    } else {
      if (!resolvedPatientName) {
        return res.status(400).json({
          success: false,
          message: 'Patient name or a valid patientId is required.'
        });
      }

      const doctorQuery = getDoctorFilter(req);
      resolvedPatient = await Patient.findOne({
        ...doctorQuery,
        $or: [
          { name: resolvedPatientName },
          ...(resolvedPhone ? [{ mobileNumber: resolvedPhone }] : [])
        ]
      });

      if (!resolvedPatient && resolvedPhone) {
        const incomingGender = req.body.gender ? String(req.body.gender).trim().toLowerCase() : '';
        const resolvedGender = incomingGender === 'female' || incomingGender === 'f' ? 'Female'
          : incomingGender === 'male' || incomingGender === 'm' ? 'Male'
          : 'Other';
        const resolvedDob = req.body.dob ? String(req.body.dob).trim() : (req.body.age && Number(req.body.age) > 0 ? `${new Date().getFullYear() - Number(req.body.age)}-01-01` : '');

        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: resolvedPatientName,
          mobileNumber: resolvedPhone,
          dob: resolvedDob,
          gender: resolvedGender,
          age: Number(req.body.age) || 0
        });
      }
    }

    const clinicalNotes = extractClinicalNotes(req.body);

    const rawFees = fees !== undefined ? fees : (amount !== undefined ? amount : 0);
    const resolvedFees = Number(rawFees) || 0;
    const resolvedDiscount = Number(discount || 0);
    const resolvedTotal = totalAmount !== undefined
      ? Number(totalAmount)
      : Math.max(0, resolvedFees - resolvedDiscount);

    // Format treatment list
    let resolvedTreatment = (treatment || '').trim();
    let treatmentList = [];
    if (Array.isArray(treatments) && treatments.length > 0) {
      treatmentList = treatments.map((t) => {
        if (typeof t === 'string') return { name: t.trim(), fees: resolvedFees, cost: resolvedFees };
        return {
          name: t.name || t.treatment || 'Treatment',
          fees: Number(t.fees || t.cost || 0),
          cost: Number(t.cost || t.fees || 0),
          notes: t.notes || ''
        };
      });
      if (!resolvedTreatment) {
        resolvedTreatment = treatmentList.map((t) => t.name).join(', ');
      }
    } else if (resolvedTreatment) {
      treatmentList = [{ name: resolvedTreatment, fees: resolvedFees, cost: resolvedFees }];
    }

    const plan = await TreatmentPlan.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      patientName: resolvedPatientName,
      phoneNumber: resolvedPhone,
      doctorName: req.user?.name || 'Dr. Self',
      clinicName: req.user?.clinicName || 'My Dental Clinic',
      date: date || new Date().toISOString().split('T')[0],
      clinicalNotes,
      treatment: resolvedTreatment,
      treatments: treatmentList,
      fees: resolvedFees,
      discount: resolvedDiscount,
      totalAmount: resolvedTotal,
      status: status || 'Proposed',
      notes: (notes || '').trim()
    });

    await plan.populate('patient');

    res.status(201).json({
      success: true,
      message: 'Treatment plan submitted successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Preview treatment plan on-the-fly (from request body before submitting)
// @route   POST /api/treatment-plans/preview
// @access  Protected
const previewTreatmentPlan = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      phoneNumber,
      phone,
      mobileNumber,
      treatment,
      treatments,
      fees,
      amount,
      discount,
      totalAmount,
      status,
      notes,
      date
    } = req.body;

    const targetPatientId = patientId || patientInputId;
    let resolvedPatient = null;
    let resolvedPatientName = (patientName || '').trim();
    let resolvedPhone = (phoneNumber || phone || mobileNumber || '').trim();

    if (targetPatientId && isValidObjectId(targetPatientId)) {
      resolvedPatient = await Patient.findById(targetPatientId);
      if (resolvedPatient) {
        resolvedPatientName = resolvedPatient.name;
        resolvedPhone = resolvedPatient.mobileNumber;
      }
    }

    const clinicalNotes = extractClinicalNotes(req.body);
    const rawFees = fees !== undefined ? fees : (amount !== undefined ? amount : 0);
    const resolvedFees = Number(rawFees) || 0;
    const resolvedDiscount = Number(discount || 0);
    const resolvedTotal = totalAmount !== undefined
      ? Number(totalAmount)
      : Math.max(0, resolvedFees - resolvedDiscount);

    let resolvedTreatment = (treatment || '').trim();
    let treatmentList = [];
    if (Array.isArray(treatments) && treatments.length > 0) {
      treatmentList = treatments.map((t) => {
        if (typeof t === 'string') return { name: t.trim(), fees: resolvedFees };
        return {
          name: t.name || t.treatment || 'Treatment',
          fees: Number(t.fees || t.cost || 0),
          notes: t.notes || ''
        };
      });
      if (!resolvedTreatment) {
        resolvedTreatment = treatmentList.map((t) => t.name).join(', ');
      }
    } else if (resolvedTreatment) {
      treatmentList = [{ name: resolvedTreatment, fees: resolvedFees }];
    }

    const preview = {
      header: {
        clinicName: req.user?.clinicName || 'My Dental Clinic',
        doctorName: req.user?.name || 'Dr. Self',
        contact: req.user?.clinicContact || req.user?.phone || '',
        address: req.user?.clinicAddress || '',
        specialization: req.user?.specialization || req.user?.occupation || 'Dental Surgeon'
      },
      patient: resolvedPatient
        ? {
            id: resolvedPatient._id,
            name: resolvedPatient.name,
            phoneNumber: resolvedPatient.mobileNumber,
            age: resolvedPatient.age,
            gender: resolvedPatient.gender,
            medicalConditions: resolvedPatient.medicalDetails?.conditions || []
          }
        : {
            name: resolvedPatientName || 'Walk-in Patient',
            phoneNumber: resolvedPhone || ''
          },
      planDetails: {
        date: date || new Date().toISOString().split('T')[0],
        status: status || 'Proposed',
        planNumber: 'PREVIEW-DRAFT'
      },
      clinicalNotes,
      treatmentSection: {
        treatment: resolvedTreatment,
        treatments: treatmentList,
        fees: resolvedFees,
        discount: resolvedDiscount,
        totalAmount: resolvedTotal
      },
      notes: (notes || '').trim()
    };

    res.status(200).json({
      success: true,
      message: 'Treatment plan preview generated successfully',
      data: preview
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get preview for an existing saved treatment plan
// @route   GET /api/treatment-plans/:id/preview
// @access  Protected
const getExistingTreatmentPlanPreview = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const plan = await TreatmentPlan.findById(req.params.id).populate('patient').populate('user');

    if (!plan || !isOwnerOrAdmin(req, plan)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const preview = {
      header: {
        clinicName: plan.clinicName || req.user?.clinicName || 'My Dental Clinic',
        doctorName: plan.doctorName || req.user?.name || 'Dr. Self',
        contact: req.user?.clinicContact || req.user?.phone || '',
        address: req.user?.clinicAddress || '',
        specialization: req.user?.specialization || 'Dental Surgeon'
      },
      patient: plan.patient
        ? {
            id: plan.patient._id,
            name: plan.patient.name,
            phoneNumber: plan.patient.mobileNumber,
            age: plan.patient.age,
            gender: plan.patient.gender,
            medicalConditions: plan.patient.medicalDetails?.conditions || []
          }
        : {
            name: plan.patientName,
            phoneNumber: plan.phoneNumber
          },
      planDetails: {
        id: plan._id,
        planNumber: plan.planNumber,
        date: plan.date,
        status: plan.status,
        createdAt: plan.createdAt
      },
      clinicalNotes: plan.clinicalNotes,
      treatmentSection: {
        treatment: plan.treatment,
        treatments: plan.treatments,
        fees: plan.fees,
        discount: plan.discount,
        totalAmount: plan.totalAmount
      },
      notes: plan.notes
    };

    res.status(200).json({
      success: true,
      message: 'Treatment plan preview loaded',
      data: preview
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all treatment plans (doctor-isolated, with filters)
// @route   GET /api/treatment-plans
// @access  Protected
const getAllTreatmentPlans = async (req, res, next) => {
  try {
    const { patientId, status, q, date, startDate, endDate } = req.query;

    const filter = getDoctorFilter(req);

    if (patientId && isValidObjectId(patientId)) {
      filter.patient = patientId;
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'All') {
      filter.status = new RegExp(`^${escapeRegex(status.trim())}$`, 'i');
    }

    if (date) {
      filter.date = date;
    } else if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { patientName: regex },
          { phoneNumber: regex },
          { planNumber: regex },
          { treatment: regex },
          { 'clinicalNotes.diagnosis': regex }
        ]
      });
    }

    const plans = await TreatmentPlan.find(filter).populate('patient').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single treatment plan by ID
// @route   GET /api/treatment-plans/:id
// @access  Protected
const getTreatmentPlanById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const plan = await TreatmentPlan.findById(req.params.id).populate('patient');

    if (!plan || !isOwnerOrAdmin(req, plan)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update treatment plan
// @route   PUT /api/treatment-plans/:id
// @access  Protected
const updateTreatmentPlan = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const plan = await TreatmentPlan.findById(req.params.id);

    if (!plan || !isOwnerOrAdmin(req, plan)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const {
      patientId,
      patient: patientInputId,
      treatment,
      treatments,
      fees,
      discount,
      totalAmount,
      status,
      notes,
      date
    } = req.body;

    const targetPatientId = patientId || patientInputId;
    if (targetPatientId && isValidObjectId(targetPatientId)) {
      const patientDoc = await Patient.findById(targetPatientId);
      if (patientDoc && isOwnerOrAdmin(req, patientDoc)) {
        plan.patient = patientDoc._id;
        plan.patientName = patientDoc.name;
        plan.phoneNumber = patientDoc.mobileNumber;
      }
    }

    // Update clinical notes if supplied
    const notesInput = extractClinicalNotes(req.body);
    if (notesInput.complaint) plan.clinicalNotes.complaint = notesInput.complaint;
    if (notesInput.observations) plan.clinicalNotes.observations = notesInput.observations;
    if (notesInput.investigation) plan.clinicalNotes.investigation = notesInput.investigation;
    if (notesInput.diagnosis) plan.clinicalNotes.diagnosis = notesInput.diagnosis;

    if (treatment !== undefined) plan.treatment = String(treatment).trim();
    if (Array.isArray(treatments)) plan.treatments = treatments;
    if (fees !== undefined) plan.fees = Number(fees);
    if (discount !== undefined) plan.discount = Number(discount);
    if (totalAmount !== undefined) {
      plan.totalAmount = Number(totalAmount);
    } else if (fees !== undefined || discount !== undefined) {
      plan.totalAmount = Math.max(0, (plan.fees || 0) - (plan.discount || 0));
    }
    if (status) plan.status = status;
    if (notes !== undefined) plan.notes = String(notes).trim();
    if (date) plan.date = date;

    await plan.save();
    await plan.populate('patient');

    res.status(200).json({
      success: true,
      message: 'Treatment plan updated successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete treatment plan
// @route   DELETE /api/treatment-plans/:id
// @access  Protected
const deleteTreatmentPlan = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    const plan = await TreatmentPlan.findById(req.params.id);

    if (!plan || !isOwnerOrAdmin(req, plan)) {
      return res.status(404).json({
        success: false,
        message: 'Treatment plan not found'
      });
    }

    await plan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Treatment plan deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createTreatmentPlan,
  previewTreatmentPlan,
  getExistingTreatmentPlanPreview,
  getAllTreatmentPlans,
  getTreatmentPlanById,
  updateTreatmentPlan,
  deleteTreatmentPlan
};

export default {
  createTreatmentPlan,
  previewTreatmentPlan,
  getExistingTreatmentPlanPreview,
  getAllTreatmentPlans,
  getTreatmentPlanById,
  updateTreatmentPlan,
  deleteTreatmentPlan
};
