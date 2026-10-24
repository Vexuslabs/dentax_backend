import express from 'express';
import {
  getAllSavedReports,
  saveReport,
  generateReport,
  searchPatientsForReport,
  getPatientDossier
} from '../controller/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Search & autocomplete for Report Center dropdown
router.get('/search', searchPatientsForReport);
router.get('/patients', searchPatientsForReport);

// Saved reports & generator
router.get('/saved', getAllSavedReports);
router.post('/save', saveReport);
router.route('/generate')
  .get(generateReport)
  .post(generateReport);

// Auto-fill & dossier data retrieval
router.get('/auto-fill', getPatientDossier);
router.get('/auto-fill/:patientId', getPatientDossier);
router.get('/patient-dossier', getPatientDossier);
router.get('/patient-dossier/:patientId', getPatientDossier);
router.get('/patient/:patientId', getPatientDossier);

export default router;
