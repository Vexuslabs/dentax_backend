import express from 'express';
import {
  getTodaysQueue,
  issueToken,
  updateQueueStatus,
  getQueueById,
  deleteQueueToken
} from '../controller/queueController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/today', getTodaysQueue);
router.get('/', getTodaysQueue);
router.post('/', issueToken);
router.get('/:id', getQueueById);
router.patch('/:id/status', updateQueueStatus);
router.delete('/:id', deleteQueueToken);

export default router;
