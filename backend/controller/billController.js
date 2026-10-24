import Bill from '../model/Bill.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Create new bill (standard or quick bill)
// @route   POST /api/bills
// @access  Protected
const createBill = async (req, res, next) => {
  try {
    const {
      patientId,
      patient: patientInputId,
      patientName,
      name,
      phoneNumber,
      phone,
      amount,
      fees,
      discount,
      total,
      totalAmount,
      status,
      paymentMethod,
      notes,
      isQuickBill,
      isPediatric,
      selectedTeeth,
      treatments,
      medicines,
      diagnosis,
      instructions,
      followUpDate,
      invoiceNumber
    } = req.body;

    let resolvedPatientName = (patientName || name || '').trim();
    let resolvedPhone = (phoneNumber || phone || '').trim();

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

      // Dynamically fetch patient details and contact numbers from the database record
      resolvedPatientName = resolvedPatient.name;
      resolvedPhone = resolvedPatient.mobileNumber;
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
        $or: [
          { name: resolvedPatientName },
          ...(resolvedPhone ? [{ mobileNumber: resolvedPhone }] : [])
        ]
      });

      if (!resolvedPatient && resolvedPhone) {
        resolvedPatient = await Patient.create({
          user: req.user ? req.user.id : null,
          name: resolvedPatientName,
          mobileNumber: resolvedPhone,
          dob: '2000-01-01',
          gender: 'Male'
        });
      }
    }

    const resolvedAmount = Number(amount !== undefined ? amount : (fees !== undefined ? fees : 0));
    const resolvedDiscount = Number(discount || 0);
    const resolvedTotal = total !== undefined
      ? Number(total)
      : (totalAmount !== undefined ? Number(totalAmount) : Math.max(0, resolvedAmount - resolvedDiscount));

    const bill = await Bill.create({
      user: req.user ? req.user.id : null,
      patient: resolvedPatient ? resolvedPatient._id : null,
      invoiceNumber,
      patientName: resolvedPatientName,
      phoneNumber: resolvedPhone,
      doctorName: req.user?.name || 'Dr. Self',
      amount: resolvedAmount,
      discount: resolvedDiscount,
      totalAmount: resolvedTotal,
      status: status || 'Pending',
      paymentMethod: paymentMethod || 'Pending',
      notes: notes || '',
      isQuickBill: isQuickBill !== undefined ? isQuickBill : (selectedTeeth && selectedTeeth.length > 0 ? true : false),
      isPediatric: isPediatric || false,
      selectedTeeth: selectedTeeth ? selectedTeeth.map(Number) : [],
      treatments: treatments || [],
      medicines: medicines || [],
      diagnosis: diagnosis || 'Dental Treatment',
      instructions: instructions || '',
      followUpDate: followUpDate || ''
    });

    await bill.populate('patient');

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bills with filters & search (doctor-isolated)
// @route   GET /api/bills
// @access  Protected
const getAllBills = async (req, res, next) => {
  try {
    const { status, q, startDate, endDate, isQuickBill, patientId } = req.query;

    const filter = getDoctorFilter(req);

    if (patientId && isValidObjectId(patientId)) {
      filter.patient = patientId;
    }

    if (status && typeof status === 'string' && status !== 'All' && status.trim()) {
      filter.status = new RegExp(`^${escapeRegex(status.trim())}$`, 'i');
    }

    if (isQuickBill !== undefined) {
      filter.isQuickBill = isQuickBill === 'true';
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { patientName: regex },
          { phoneNumber: regex },
          { invoiceNumber: regex },
          { notes: regex }
        ]
      });
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const bills = await Bill.find(filter).populate('patient').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bills.length,
      data: bills
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bill by ID
// @route   GET /api/bills/:id
// @access  Protected
const getBillById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findById(req.params.id).populate('patient');

    if (!bill || !isOwnerOrAdmin(req, bill)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update bill (status, payment method, amount)
// @route   PUT /api/bills/:id
// @access  Protected
const updateBill = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findById(req.params.id);

    if (!bill || !isOwnerOrAdmin(req, bill)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
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
        updateData.phoneNumber = patientDoc.mobileNumber;
      }
    }

    const updatedBill = await Bill.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).populate('patient');

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: updatedBill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Protected
const deleteBill = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findById(req.params.id);

    if (!bill || !isOwnerOrAdmin(req, bill)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    await bill.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get billing statistics (scoped to current doctor)
// @route   GET /api/bills/stats
// @access  Protected
const getBillStats = async (req, res, next) => {
  try {
    const userMatch = req.user && req.user.role !== 'Admin'
      ? { user: req.user._id }
      : {};

    const [totalBilled, paidBills, pendingBills] = await Promise.all([
      Bill.aggregate([
        { $match: userMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { ...userMatch, status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { ...userMatch, status: { $in: ['Pending', 'Partially Paid'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAmount: totalBilled[0]?.total || 0,
        totalCount: totalBilled[0]?.count || 0,
        paidAmount: paidBills[0]?.total || 0,
        paidCount: paidBills[0]?.count || 0,
        pendingAmount: pendingBills[0]?.total || 0,
        pendingCount: pendingBills[0]?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  getBillStats
};

export default {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  getBillStats
};
