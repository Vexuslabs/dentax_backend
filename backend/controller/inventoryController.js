import Inventory from '../model/Inventory.js';
import InventoryTransaction from '../model/InventoryTransaction.js';
import PurchaseOrder from '../model/PurchaseOrder.js';
import { escapeRegex, isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// ================= INVENTORY ITEMS =================

// @desc    Get all inventory items (doctor-isolated)
// @route   GET /api/inventory
// @access  Protected
const getAllInventory = async (req, res, next) => {
  try {
    const { category, status, q } = req.query;

    const filter = getDoctorFilter(req);

    if (category && category !== 'All' && category !== 'Select category') {
      filter.category = category;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { productName: regex },
          { category: regex },
          { description: regex }
        ]
      });
    }

    const items = await Inventory.find(filter).sort({ productName: 1 });

    // Inventory summary statistics
    const totalItems = items.length;
    const lowStockCount = items.filter((i) => i.status === 'Low Stock').length;
    const outOfStockCount = items.filter((i) => i.status === 'Out of Stock').length;
    const inStockCount = items.filter((i) => i.status === 'In Stock').length;
    const totalStockValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.status(200).json({
      success: true,
      count: totalItems,
      summary: {
        totalItems,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalStockValue
      },
      data: items
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add new inventory item
// @route   POST /api/inventory
// @access  Protected
const addInventoryItem = async (req, res, next) => {
  try {
    const {
      name,
      productName,
      category,
      qty,
      quantity,
      price,
      expireDate,
      expiry,
      warningLevel,
      description,
      desc
    } = req.body;

    const resolvedName = (name || productName || '').trim();
    if (!resolvedName) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required.'
      });
    }

    const resolvedQty = Number(qty !== undefined ? qty : (quantity !== undefined ? quantity : 0));
    const resolvedPrice = Number(price || 0);
    const resolvedWarning = Number(warningLevel || 10);
    const resolvedExpiry = (expireDate || expiry || 'Standard').trim();
    const resolvedDesc = (description || desc || '').trim();
    const resolvedCategory = (category && category !== 'Select category') ? category.trim() : 'Medicine';

    const item = await Inventory.create({
      user: req.user ? req.user.id : null,
      productName: resolvedName,
      category: resolvedCategory,
      quantity: resolvedQty,
      price: resolvedPrice,
      expireDate: resolvedExpiry,
      warningLevel: resolvedWarning,
      description: resolvedDesc
    });

    res.status(201).json({
      success: true,
      message: 'Product added to inventory',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Protected
const updateInventoryItem = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in inventory'
      });
    }

    const item = await Inventory.findById(req.params.id);

    if (!item || !isOwnerOrAdmin(req, item)) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in inventory'
      });
    }

    const updateData = { ...req.body };
    delete updateData.user;

    Object.assign(item, updateData);
    await item.save();

    res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Protected
const deleteInventoryItem = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in inventory'
      });
    }

    const item = await Inventory.findById(req.params.id);

    if (!item || !isOwnerOrAdmin(req, item)) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in inventory'
      });
    }

    await item.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Item removed from inventory'
    });
  } catch (error) {
    next(error);
  }
};

// ================= TRANSACTIONS (STOCK IN / OUT) =================

// @desc    Record Stock In / Stock Out
// @route   POST /api/inventory/transactions
// @access  Protected
const recordStockTransaction = async (req, res, next) => {
  try {
    const { inventoryId, type, title, category, quantity, amount, remarks } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        message: 'Transaction type and product title are required.'
      });
    }

    const qty = Number(quantity || 1);
    const doctorScope = getDoctorFilter(req);

    // If linked to inventory item or found by title, update stock scoped to this doctor
    let item = null;
    if (inventoryId && isValidObjectId(inventoryId)) {
      item = await Inventory.findOne({ _id: inventoryId, ...doctorScope });
    } else if (title && typeof title === 'string') {
      item = await Inventory.findOne({
        ...doctorScope,
        productName: new RegExp(`^${escapeRegex(title.trim())}$`, 'i')
      });
    }

    if (item) {
      if (type === 'Stock Out') {
        if (item.quantity < qty) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock! Current stock: ${item.quantity}, requested: ${qty}`
          });
        }
        item.quantity -= qty;
      } else if (type === 'Stock In') {
        item.quantity += qty;
      } else if (type === 'Adjustment') {
        item.quantity = qty;
      }
      await item.save();
    }

    const transaction = await InventoryTransaction.create({
      user: req.user ? req.user.id : null,
      inventoryItem: item ? item._id : null,
      type,
      title: title.trim(),
      category: category || (type === 'Stock In' ? 'Inward' : 'Outward'),
      quantity: qty,
      amount: Number(amount || 0),
      remarks: remarks || ''
    });

    res.status(201).json({
      success: true,
      message: `${type} transaction recorded successfully`,
      data: transaction,
      updatedInventoryItem: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all inventory transactions (doctor-isolated)
// @route   GET /api/inventory/transactions
// @access  Protected
const getAllTransactions = async (req, res, next) => {
  try {
    const { type, q } = req.query;

    const filter = getDoctorFilter(req);
    if (type && type !== 'All') {
      filter.type = type;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: regex },
          { category: regex },
          { remarks: regex }
        ]
      });
    }

    const transactions = await InventoryTransaction.find(filter).sort({ date: -1, createdAt: -1 });
    const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    res.status(200).json({
      success: true,
      count: transactions.length,
      totalAmount,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// ================= PURCHASE ORDERS =================

// @desc    Get all purchase orders (doctor-isolated)
// @route   GET /api/inventory/purchase-orders
// @access  Protected
const getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { status, vendor } = req.query;

    const filter = getDoctorFilter(req);
    if (status && status !== 'All') filter.status = status;
    if (vendor && typeof vendor === 'string' && vendor.trim()) {
      filter.vendor = new RegExp(escapeRegex(vendor.trim()), 'i');
    }

    const orders = await PurchaseOrder.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create purchase order
// @route   POST /api/inventory/purchase-orders
// @access  Protected
const createPurchaseOrder = async (req, res, next) => {
  try {
    const { vendor, subtitle, date, status, items, totalAmount } = req.body;

    if (!vendor) {
      return res.status(400).json({
        success: false,
        message: 'Vendor name is required.'
      });
    }

    const po = await PurchaseOrder.create({
      user: req.user ? req.user.id : null,
      vendor: vendor.trim(),
      subtitle: subtitle ? subtitle.trim() : 'Purchase Order',
      date: date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: status || 'Pending',
      items: items || [],
      totalAmount: Number(totalAmount || 0)
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: po
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase order status
// @route   PATCH /api/inventory/purchase-orders/:id/status
// @access  Protected
const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const po = await PurchaseOrder.findById(req.params.id);

    if (!po || !isOwnerOrAdmin(req, po)) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    po.status = status;
    await po.save();

    res.status(200).json({
      success: true,
      message: `Purchase order updated to ${status}`,
      data: po
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockTransaction,
  getAllTransactions,
  getAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus
};

export default {
  getAllInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockTransaction,
  getAllTransactions,
  getAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus
};
