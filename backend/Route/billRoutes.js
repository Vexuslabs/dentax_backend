import express from 'express';
import {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  getBillStats
} from '../controller/billController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/stats', getBillStats);

router.route('/')
  .post(createBill)
  .get(getAllBills);

router.route('/:id')
  .get(getBillById)
  .put(updateBill)
  .delete(deleteBill);

export default router;
