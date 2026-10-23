import express from 'express';
import {
  createTransaction,
  getAllTransactions,
  getAccountSummary,
  deleteTransaction
} from '../controller/accountController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/summary', getAccountSummary);

router.route('/')
  .post(createTransaction)
  .get(getAllTransactions);

router.route('/:id')
  .delete(deleteTransaction);

export default router;
