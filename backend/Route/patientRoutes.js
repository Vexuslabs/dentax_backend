import express from 'express';
import {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getDentalChart,
  updateDentalChart
} from '../controller/patientController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.route('/')
  .post(createPatient)
  .get(getAllPatients);

router.route('/:id/dental-chart')
  .get(getDentalChart)
  .put(updateDentalChart);

router.route('/:id')
  .get(getPatientById)
  .put(updatePatient)
  .delete(deletePatient);

export default router;
