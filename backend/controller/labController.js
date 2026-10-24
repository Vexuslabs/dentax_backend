import Lab from '../model/Lab.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Create new lab order (ID-based patient linkage, doctor-isolated)
// @route   POST /api/lab
// @access  Protected
const createLabOrder = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      doctorName,
      labName,
      date,
      time,
      teeth,
      selectedTeeth,
      prosthesis,
      prosthesisType,
      surface,
      surfaceCluster,
      pontic,
      ponticType,
      implant,
      implantType,
      metalTrial,
      bisqueTrial,
      finalDate,
      expectedDelivery,
      total,
      charges,
      status,
      workStatus,
      notes
    } = req.body;

    let resolvedPatientName = (patientName || name || '').trim();

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

      // Dynamically fetch patient details from the database record
      resolvedPatientName = resolvedPatient.name;
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
        name: resolvedPatientName
      });
    }

    if (!labName) {
      return res.status(400).json({
        success: false,
        message: 'Lab name is required.'
      });
    }

    // Resolve teeth array to strings
    const rawTeeth = selectedTeeth || teeth || [];
    const resolvedTeeth = Array.isArray(rawTeeth) ? rawTeeth.map(String) : [];

    // Resolve prosthesis
    const rawProsthesis = prosthesisType || prosthesis || [];
    const resolvedProsthesis = Array.isArray(rawProsthesis) ? rawProsthesis : [String(rawProsthesis)];

    // Resolve delivery dates
    const resolvedDelivery = expectedDelivery || {
      metalTrial: metalTrial || '',
      bisqueTrial: bisqueTrial || '',
      final: finalDate || ''
    };

    // Resolve charges
    const resolvedCharges = charges || {
      total: Number(total || 0),
      quantity: resolvedTeeth.length || 1
    };

    const labOrder = await Lab.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      patientName: resolvedPatientName,
      doctorName: (doctorName || req.user?.name || 'Dr. Self').trim(),
      labName: labName.trim(),
      date: date || new Date().toISOString().split('T')[0],
      time: time || '10:00 AM',
      selectedTeeth: resolvedTeeth,
      prosthesisType: resolvedProsthesis,
      surfaceCluster: surfaceCluster || (Array.isArray(surface) ? surface[0] : surface) || 'Glossy',
      ponticType: ponticType || (Array.isArray(pontic) ? pontic[0] : pontic) || 'Modified Ridge Lap',
      implantType: implantType || (Array.isArray(implant) ? implant[0] : implant) || 'Screw Retained',
      expectedDelivery: resolvedDelivery,
      charges: resolvedCharges,
      status: status || 'Pending',
      workStatus: workStatus || status || 'Pending',
      notes: notes || ''
    });

    await labOrder.populate('patient');

    res.status(201).json({
      success: true,
      message: 'Dental lab work order created successfully',
      data: labOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all lab orders with search & status filters (doctor-isolated)
// @route   GET /api/lab
// @access  Protected
const getAllLabOrders = async (req, res, next) => {
  try {
    const { q, status, labName, patientId } = req.query;

    const filter = getDoctorFilter(req);

    if (patientId && isValidObjectId(patientId)) {
      filter.patient = patientId;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (labName && typeof labName === 'string' && labName.trim()) {
      filter.labName = new RegExp(escapeRegex(labName.trim()), 'i');
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { patientName: regex },
          { doctorName: regex },
          { labName: regex }
        ]
      });
    }

    const labOrders = await Lab.find(filter).populate('patient').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: labOrders.length,
      data: labOrders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lab order by ID
// @route   GET /api/lab/:id
// @access  Protected
const getLabOrderById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findById(req.params.id).populate('patient');

    if (!labOrder || !isOwnerOrAdmin(req, labOrder)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: labOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lab order
// @route   PUT /api/lab/:id
// @access  Protected
const updateLabOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findById(req.params.id);

    if (!labOrder || !isOwnerOrAdmin(req, labOrder)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
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

    const updatedOrder = await Lab.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('patient');

    res.status(200).json({
      success: true,
      message: 'Lab order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete lab order
// @route   DELETE /api/lab/:id
// @access  Protected
const deleteLabOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findById(req.params.id);

    if (!labOrder || !isOwnerOrAdmin(req, labOrder)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    await labOrder.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Lab order deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createLabOrder,
  getAllLabOrders,
  getLabOrderById,
  updateLabOrder,
  deleteLabOrder
};

export default {
  createLabOrder,
  getAllLabOrders,
  getLabOrderById,
  updateLabOrder,
  deleteLabOrder
};
