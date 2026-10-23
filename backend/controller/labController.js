import Lab from '../model/Lab.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

// @desc    Create new lab order
// @route   POST /api/lab
// @access  Public / Protected
const createLabOrder = async (req, res, next) => {
  try {
    const {
      patientName,
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

    if (!patientName || !doctorName || !labName) {
      return res.status(400).json({
        success: false,
        message: 'Patient name, doctor name, and lab name are required.'
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

    // Try linking patient
    let patient = await Patient.findOne({ name: patientName.trim() });

    const labOrder = await Lab.create({
      user: req.user ? req.user.id : null,
      patient: patient ? patient._id : null,
      patientName: patientName.trim(),
      doctorName: doctorName.trim(),
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

    res.status(201).json({
      success: true,
      message: 'Dental lab work order created successfully',
      data: labOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all lab orders with search & status filters
// @route   GET /api/lab
// @access  Public / Protected
const getAllLabOrders = async (req, res, next) => {
  try {
    const { q, status, labName } = req.query;

    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (labName && typeof labName === 'string' && labName.trim()) {
      filter.labName = new RegExp(escapeRegex(labName.trim()), 'i');
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { patientName: regex },
        { doctorName: regex },
        { labName: regex }
      ];
    }

    const labOrders = await Lab.find(filter).sort({ createdAt: -1 });

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
// @access  Public / Protected
const getLabOrderById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findById(req.params.id);

    if (!labOrder) {
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

// @desc    Update lab order status & delivery dates
// @route   PUT /api/lab/:id
// @access  Public / Protected
const updateLabOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!labOrder) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lab order updated successfully',
      data: labOrder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete lab order
// @route   DELETE /api/lab/:id
// @access  Public / Protected
const deleteLabOrder = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    const labOrder = await Lab.findByIdAndDelete(req.params.id);

    if (!labOrder) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lab order removed successfully'
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
