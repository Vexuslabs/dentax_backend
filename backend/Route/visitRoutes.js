import express from 'express';
import {
  createVisit,
  getAllVisits,
  getVisitById,
  updateVisit,
  deleteVisit
} from '../controller/visitController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(createVisit)
  .get(getAllVisits);

router.route('/:id')
  .get(getVisitById)
  .put(updateVisit)
  .delete(deleteVisit);

export default router;
