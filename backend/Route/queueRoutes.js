import express from 'express';
import {
  getTodaysQueue,
  issueToken,
  updateQueueStatus,
  getQueueById,
  deleteQueueToken
} from '../controller/queueController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/today', getTodaysQueue);
router.patch('/:id/status', updateQueueStatus);

router.route('/')
  .post(issueToken)
  .get(getTodaysQueue);

router.route('/:id')
  .get(getQueueById)
  .delete(deleteQueueToken);

export default router;
