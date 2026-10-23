import express from 'express';
import {
  createLabOrder,
  getAllLabOrders,
  getLabOrderById,
  updateLabOrder,
  deleteLabOrder
} from '../controller/labController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.route('/')
  .post(createLabOrder)
  .get(getAllLabOrders);

router.route('/:id')
  .get(getLabOrderById)
  .put(updateLabOrder)
  .delete(deleteLabOrder);

export default router;
