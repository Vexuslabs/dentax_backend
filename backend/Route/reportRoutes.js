import express from 'express';
import {
  getAllSavedReports,
  saveReport,
  generateReport,
  getPatientDossier
} from '../controller/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/saved', getAllSavedReports);
router.post('/save', saveReport);
router.route('/generate')
  .get(generateReport)
  .post(generateReport);
router.get('/patient-dossier/:patientId', getPatientDossier);

export default router;
