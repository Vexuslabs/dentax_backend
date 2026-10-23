import express from 'express';
import {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  getBillStats
} from '../controller/billController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/stats', getBillStats);

router.route('/')
  .post(createBill)
  .get(getAllBills);

router.route('/:id')
  .get(getBillById)
  .put(updateBill)
  .delete(deleteBill);

export default router;
