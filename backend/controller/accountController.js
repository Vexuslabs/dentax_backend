import Account from '../model/Account.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Record new transaction (Income / Expense)
// @route   POST /api/accounts
// @access  Protected
const createTransaction = async (req, res, next) => {
  try {
    const { type, title, category, amount, description, date } = req.body;

    if (!type || !title || !category || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, category, and amount are required.'
      });
    }

    if (!['income', 'expense'].includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Type must be either 'income' or 'expense'."
      });
    }

    const transaction = await Account.create({
      user: req.user ? req.user.id : null,
      type: type.toLowerCase(),
      title: title.trim(),
      category: category.trim(),
      amount: Number(amount),
      description: description ? description.trim() : '',
      date: date ? new Date(date) : new Date()
    });

    res.status(201).json({
      success: true,
      message: `${type.toUpperCase()} recorded successfully`,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all transactions with optional filters (doctor-isolated)
// @route   GET /api/accounts
// @access  Protected
const getAllTransactions = async (req, res, next) => {
  try {
    const { type, category, startDate, endDate, q } = req.query;

    const filter = getDoctorFilter(req);

    if (type && type !== 'all') {
      filter.type = type.toLowerCase();
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: regex },
          { category: regex },
          { description: regex }
        ]
      });
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const transactions = await Account.find(filter).sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get account balance and financial summary (doctor-isolated)
// @route   GET /api/accounts/summary
// @access  Protected
const getAccountSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const userMatch = req.user && req.user.role !== 'Admin'
      ? { user: req.user._id }
      : {};

    const matchStage = { ...userMatch };
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.date.$lte = end;
      }
    }

    const [incomeAgg, expenseAgg, categoryAgg] = await Promise.all([
      Account.aggregate([
        { $match: { ...matchStage, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Account.aggregate([
        { $match: { ...matchStage, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Account.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { type: '$type', category: '$category' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const balance = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        balance,
        incomeCount: incomeAgg[0]?.count || 0,
        expenseCount: expenseAgg[0]?.count || 0,
        categoryBreakdown: categoryAgg.map((c) => ({
          type: c._id.type,
          category: c._id.category,
          total: c.total,
          count: c.count
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/accounts/:id
// @access  Protected
const deleteTransaction = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = await Account.findById(req.params.id);

    if (!transaction || !isOwnerOrAdmin(req, transaction)) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    await transaction.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createTransaction,
  getAllTransactions,
  getAccountSummary,
  deleteTransaction
};

export default {
  createTransaction,
  getAllTransactions,
  getAccountSummary,
  deleteTransaction
};
