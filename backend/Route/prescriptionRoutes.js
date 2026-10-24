import express from 'express';
import {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionsByPatientId,
  getPrescriptionById,
  updatePrescription,
  deletePrescription
} from '../controller/prescriptionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(createPrescription)
  .get(getAllPrescriptions);

router.get('/patient/:patientId', getPrescriptionsByPatientId);

router.route('/:id')
  .get(getPrescriptionById)
  .put(updatePrescription)
  .delete(deletePrescription);

export default router;
