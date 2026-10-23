import express from 'express';
import {
  createVisit,
  getAllVisits,
  getVisitById,
  updateVisit,
  deleteVisit
} from '../controller/visitController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.route('/')
  .post(createVisit)
  .get(getAllVisits);

router.route('/:id')
  .get(getVisitById)
  .put(updateVisit)
  .delete(deleteVisit);

export default router;
