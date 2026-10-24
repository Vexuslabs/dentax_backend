import express from 'express';
import {
  createBill,
  createQuickBill,
  getQuickBillTreatments,
  previewQuickBill,
  getQuickBills,
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

// Quick Bill treatments catalogue (Cleaning, Filling, Root Canal, Extraction)
router.get('/quick/treatments', getQuickBillTreatments);
router.get('/quick-treatments', getQuickBillTreatments);

// Quick Bill calculation preview (pre-calculation before save)
router.post('/quick/preview', previewQuickBill);
router.post('/quick-preview', previewQuickBill);

// Quick Bill creation & retrieval
router.route('/quick')
  .post(createQuickBill)
  .get(getQuickBills);

router.route('/quick-bill')
  .post(createQuickBill)
  .get(getQuickBills);

router.route('/')
  .post(createBill)
  .get(getAllBills);

router.route('/:id')
  .get(getBillById)
  .put(updateBill)
  .delete(deleteBill);

export default router;
