import express from 'express';
import {
  getAllSavedReports,
  saveReport,
  generateReport,
  getPatientDossier
} from '../controller/reportController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

router.get('/saved', getAllSavedReports);
router.post('/save', saveReport);
router.get('/generate', generateReport);
router.get('/patient-dossier/:patientId', getPatientDossier);

export default router;
