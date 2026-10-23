import Bill from '../model/Bill.js';
import Patient from '../model/Patient.js';
import { escapeRegex, isValidObjectId } from '../utils/helpers.js';

// @desc    Create new bill (standard or quick bill)
// @route   POST /api/bills
// @access  Public / Protected
const createBill = async (req, res, next) => {
  try {
    const {
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

    const resolvedPatientName = (patientName || name || '').trim();
    const resolvedPhone = (phoneNumber || phone || '').trim();

    if (!resolvedPatientName) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required.'
      });
    }

    const resolvedAmount = Number(amount !== undefined ? amount : (fees !== undefined ? fees : 0));
    const resolvedDiscount = Number(discount || 0);
    const resolvedTotal = total !== undefined ? Number(total) : (totalAmount !== undefined ? Number(totalAmount) : (resolvedAmount - resolvedDiscount < 0 ? 0 : resolvedAmount - resolvedDiscount));

    // Try linking patient
    let patient = await Patient.findOne({
      $or: [
        { name: resolvedPatientName },
        ...(resolvedPhone ? [{ mobileNumber: resolvedPhone }] : [])
      ]
    });

    if (!patient && resolvedPhone) {
      patient = await Patient.create({
        user: req.user ? req.user.id : null,
        name: resolvedPatientName,
        mobileNumber: resolvedPhone,
        dob: '2000-01-01',
        gender: 'Male'
      });
    }

    const bill = await Bill.create({
      user: req.user ? req.user.id : null,
      patient: patient ? patient._id : null,
      invoiceNumber,
      patientName: resolvedPatientName,
      phoneNumber: resolvedPhone,
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

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bills with filters & search
// @route   GET /api/bills
// @access  Public / Protected
const getAllBills = async (req, res, next) => {
  try {
    const { status, q, startDate, endDate, isQuickBill } = req.query;

    const filter = {};

    if (status && typeof status === 'string' && status !== 'All' && status.trim()) {
      filter.status = new RegExp(`^${escapeRegex(status.trim())}$`, 'i');
    }

    if (isQuickBill !== undefined) {
      filter.isQuickBill = isQuickBill === 'true';
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { patientName: regex },
        { phoneNumber: regex },
        { invoiceNumber: regex },
        { notes: regex }
      ];
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

    const bills = await Bill.find(filter).sort({ createdAt: -1 });

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
// @access  Public / Protected
const getBillById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findById(req.params.id);

    if (!bill) {
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
// @access  Public / Protected
const updateBill = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Public / Protected
const deleteBill = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = await Bill.findByIdAndDelete(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get billing statistics
// @route   GET /api/bills/stats
// @access  Public / Protected
const getBillStats = async (req, res, next) => {
  try {
    const [totalBilled, paidBills, pendingBills] = await Promise.all([
      Bill.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { status: { $in: ['Pending', 'Partially Paid'] } } },
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
