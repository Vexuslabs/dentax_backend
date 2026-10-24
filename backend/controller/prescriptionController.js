import Prescription from '../model/Prescription.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// Robust parser for medicines supporting objects, strings, arrays, JSON strings, and alternate key names
export const parseMedicinesInput = (input, reqBody = {}) => {
  let list = [];
  let raw = input;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        raw = JSON.parse(trimmed);
      } catch (_) {
        // Fall back to comma-separated below
      }
    }
  }

  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object' && raw !== null) {
    list = [raw];
  } else if (typeof raw === 'string' && raw.trim().length > 0) {
    list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // If list is empty, check if top-level medicine fields were passed directly in reqBody
  // (e.g. from the single Medicine name + Dose inputs on screen)
  if (list.length === 0 && reqBody) {
    const topName = (reqBody.medicineName || reqBody.medicine_name || reqBody.medicine || reqBody.drugName || reqBody.drug || '').trim();
    const topDose = String(reqBody.dose || reqBody.dosage || reqBody.strength || reqBody.quantity || '').trim();
    if (topName || topDose) {
      list.push({
        name: topName || 'Medicine',
        dosage: topDose,
        dose: topDose
      });
    }
  }

  return list.map((m) => {
    if (typeof m === 'string') {
      return {
        name: m.trim(),
        dosage: '',
        dose: '',
        duration: '',
        timing: ''
      };
    }
    if (typeof m === 'object' && m !== null) {
      const name = (m.name || m.medicineName || m.medicine_name || m.medicine || m.drugName || m.drug || m.title || '').trim();
      const dose = String(m.dose || m.dosage || m.dose_amount || m.strength || m.quantity || m.qty || '').trim();
      const duration = String(m.duration || m.days || m.period || m.time || '').trim();
      const timing = String(m.timing || m.frequency || m.instructions || m.when || m.schedule || '').trim();
      return {
        name: name || 'Medicine',
        dosage: dose,
        dose: dose,
        duration,
        timing
      };
    }
    return { name: 'Medicine', dosage: '', dose: '', duration: '', timing: '' };
  }).filter((m) => m.name && m.name.length > 0);
};

// @desc    Create new prescription
// @route   POST /api/prescriptions
// @access  Protected
const createPrescription = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      doctorName,
      diagnosis,
      notes,
      tag,
      medicines,
      instructions,
      status,
      followUpDate
    } = req.body;

    // 1. Patient resolution (flexible for dropdown, ID, object, or custom name)
    let targetPatientId = null;
    let rawPatientName = (patientName || name || '').trim();

    if (patientId) {
      if (typeof patientId === 'string' && isValidObjectId(patientId)) {
        targetPatientId = patientId;
      } else if (typeof patientId === 'object' && patientId !== null && (patientId._id || patientId.id)) {
        targetPatientId = (patientId._id || patientId.id).toString();
        if (!rawPatientName && patientId.name) rawPatientName = patientId.name;
      } else if (typeof patientId === 'string' && !rawPatientName) {
        rawPatientName = patientId.trim();
      }
    }

    if (!targetPatientId && patientInputId) {
      if (typeof patientInputId === 'string' && isValidObjectId(patientInputId)) {
        targetPatientId = patientInputId;
      } else if (typeof patientInputId === 'object' && patientInputId !== null && (patientInputId._id || patientInputId.id)) {
        targetPatientId = (patientInputId._id || patientInputId.id).toString();
        if (!rawPatientName && patientInputId.name) rawPatientName = patientInputId.name;
      } else if (typeof patientInputId === 'string' && !rawPatientName) {
        rawPatientName = patientInputId.trim();
      }
    }

    let resolvedPatient = null;
    const doctorQuery = getDoctorFilter(req);

    // If ID is valid, lookup patient by ID
    if (targetPatientId && isValidObjectId(targetPatientId)) {
      resolvedPatient = await Patient.findById(targetPatientId);
      if (resolvedPatient && isOwnerOrAdmin(req, resolvedPatient)) {
        rawPatientName = resolvedPatient.name;
      }
    }

    // If not found by ID, lookup by patient name
    if (!resolvedPatient && rawPatientName) {
      resolvedPatient = await Patient.findOne({
        ...doctorQuery,
        name: { $regex: new RegExp(`^${escapeRegex(rawPatientName)}$`, 'i') }
      });
    }

    // Auto-create patient if not found (e.g. custom name entered in dropdown or new patient)
    if (!resolvedPatient && rawPatientName) {
      resolvedPatient = await Patient.create({
        user: req.user ? req.user.id : null,
        name: rawPatientName,
        mobileNumber: req.body.mobileNumber || req.body.phoneNumber || req.body.phone || '0000000000',
        dob: req.body.dob || '',
        gender: req.body.gender ? String(req.body.gender).trim() : 'Other',
        age: Number(req.body.age) || 0
      });
    }

    const resolvedPatientName = (resolvedPatient?.name || rawPatientName || 'Patient').trim();

    // 2. Doctor resolution (flexible for Doctor Name dropdown, doctor object, or auth doctor)
    let resolvedDoctorName = '';
    if (doctorName && typeof doctorName === 'string') {
      resolvedDoctorName = doctorName.trim();
    } else if (req.body.doctor) {
      if (typeof req.body.doctor === 'string') resolvedDoctorName = req.body.doctor.trim();
      else if (typeof req.body.doctor === 'object' && req.body.doctor.name) resolvedDoctorName = req.body.doctor.name.trim();
    } else if (req.body.doctor_name && typeof req.body.doctor_name === 'string') {
      resolvedDoctorName = req.body.doctor_name.trim();
    }
    if (!resolvedDoctorName) {
      resolvedDoctorName = req.user?.name || 'Dr. Self';
    }

    // 3. Diagnosis resolution (manual text input overrides dropdown; default is 'Routine Checkup')
    const rawManualDiagnosis = (req.body.manualDiagnosis || req.body.manual_diagnosis || req.body.customDiagnosis || req.body.custom_diagnosis || req.body.otherDiagnosis || '').trim();
    const rawDropdownDiagnosis = (diagnosis || req.body.selectedDiagnosis || req.body.diagnosisDropdown || notes || '').trim();
    const resolvedDiagnosis = rawManualDiagnosis || (rawDropdownDiagnosis && rawDropdownDiagnosis !== 'Select Diagnosis' ? rawDropdownDiagnosis : '') || 'Routine Checkup';

    // 4. Special Instructions resolution
    const resolvedInstructions = (
      req.body.specialInstructions ||
      req.body.special_instructions ||
      req.body.specialInstruction ||
      instructions ||
      req.body.instruction ||
      req.body.advice ||
      ''
    ).trim();

    // 5. Robust parsing of medicines
    const inputMedicines = medicines !== undefined ? medicines : (req.body.medicineList || req.body.drugs || req.body.items);
    const parsedMedicines = parseMedicinesInput(inputMedicines, req.body);

    const prescription = await Prescription.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      patientName: resolvedPatientName,
      doctorName: resolvedDoctorName,
      diagnosis: resolvedDiagnosis,
      tag: tag || resolvedDiagnosis,
      medicines: parsedMedicines,
      instructions: resolvedInstructions,
      status: status || 'Active',
      followUpDate: followUpDate || ''
    });

    if (resolvedPatient) {
      await prescription.populate('patient');
    }

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all prescriptions with filters & search (doctor-isolated)
// @route   GET /api/prescriptions
// @access  Protected
const getAllPrescriptions = async (req, res, next) => {
  try {
    const { q, filter, status, patientId, patient, patient_id, patientName } = req.query;

    const queryObj = getDoctorFilter(req);

    // Patient ID / Name filtering
    const rawPatientId = patientId || patient || patient_id;
    if (rawPatientId) {
      if (isValidObjectId(rawPatientId)) {
        queryObj.$or = [
          { patient: rawPatientId },
          { patientName: { $regex: new RegExp(`^${escapeRegex(rawPatientId)}$`, 'i') } }
        ];
      } else {
        queryObj.patientName = { $regex: new RegExp(escapeRegex(rawPatientId), 'i') };
      }
    } else if (patientName && typeof patientName === 'string') {
      queryObj.patientName = { $regex: new RegExp(escapeRegex(patientName.trim()), 'i') };
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      queryObj.$and = queryObj.$and || [];
      queryObj.$and.push({
        $or: [
          { patientName: regex },
          { doctorName: regex },
          { diagnosis: regex },
          { 'medicines.name': regex },
          { 'medicines.medicineName': regex },
          { 'medicines.dose': regex },
          { 'medicines.dosage': regex }
        ]
      });
    }

    if (status && status !== 'All') {
      queryObj.status = status;
    }

    // Timeframe filters: "Today", "This Week", "This Month"
    if (filter) {
      const now = new Date();
      if (filter === 'Today') {
        const start = new Date(now.setHours(0, 0, 0, 0));
        const end = new Date(now.setHours(23, 59, 59, 999));
        queryObj.createdAt = { $gte: start, $lte: end };
      } else if (filter === 'This Week') {
        const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        firstDayOfWeek.setHours(0, 0, 0, 0);
        queryObj.createdAt = { $gte: firstDayOfWeek };
      } else if (filter === 'This Month') {
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        queryObj.createdAt = { $gte: firstDayOfMonth };
      }
    }

    const prescriptions = await Prescription.find(queryObj)
      .populate('patient')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescriptions by patient ID
// @route   GET /api/prescriptions/patient/:patientId
// @access  Protected
const getPrescriptionsByPatientId = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const doctorScope = getDoctorFilter(req);

    const filter = {
      ...doctorScope
    };

    if (isValidObjectId(patientId)) {
      filter.$or = [
        { patient: patientId },
        { patientName: { $regex: new RegExp(`^${escapeRegex(patientId)}$`, 'i') } }
      ];
    } else {
      filter.patientName = { $regex: new RegExp(escapeRegex(patientId), 'i') };
    }

    const prescriptions = await Prescription.find(filter)
      .populate('patient')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Protected
const getPrescriptionById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id).populate('patient');

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Protected
const updatePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
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
      }
    }

    if (req.body.doctorName || req.body.doctor || req.body.doctor_name) {
      updateData.doctorName = (req.body.doctorName || req.body.doctor || req.body.doctor_name).trim();
    }

    if (req.body.specialInstructions || req.body.special_instructions || req.body.instructions) {
      updateData.instructions = (req.body.specialInstructions || req.body.special_instructions || req.body.instructions).trim();
    }

    if (req.body.manualDiagnosis || req.body.manual_diagnosis || req.body.customDiagnosis) {
      updateData.diagnosis = (req.body.manualDiagnosis || req.body.manual_diagnosis || req.body.customDiagnosis).trim();
    }

    if (req.body.medicines !== undefined || req.body.medicineList !== undefined || req.body.drugs !== undefined || req.body.items !== undefined || req.body.medicineName || req.body.dose) {
      const inputMeds = req.body.medicines !== undefined ? req.body.medicines : (req.body.medicineList || req.body.drugs || req.body.items);
      updateData.medicines = parseMedicinesInput(inputMeds, req.body);
    }

    const updatedPrescription = await Prescription.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('patient');

    res.status(200).json({
      success: true,
      message: 'Prescription updated successfully',
      data: updatedPrescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Protected
const deletePrescription = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = await Prescription.findById(req.params.id);

    if (!prescription || !isOwnerOrAdmin(req, prescription)) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    await prescription.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Prescription deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionsByPatientId,
  getPrescriptionById,
  updatePrescription,
  deletePrescription
};

export default {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionsByPatientId,
  getPrescriptionById,
  updatePrescription,
  deletePrescription
};
