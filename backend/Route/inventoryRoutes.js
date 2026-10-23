import express from 'express';
import {
  getAllInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordStockTransaction,
  getAllTransactions,
  getAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus
} from '../controller/inventoryController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

// Transactions (Stock In / Stock Out)
router.route('/transactions')
  .post(recordStockTransaction)
  .get(getAllTransactions);

// Purchase Orders
router.route('/purchase-orders')
  .post(createPurchaseOrder)
  .get(getAllPurchaseOrders);

router.patch('/purchase-orders/:id/status', updatePurchaseOrderStatus);

// Inventory Items
router.route('/')
  .post(addInventoryItem)
  .get(getAllInventory);

router.route('/:id')
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

export default router;
