import express from 'express';
import {
  createTreatmentPlan,
  previewTreatmentPlan,
  getExistingTreatmentPlanPreview,
  getAllTreatmentPlans,
  getTreatmentPlanById,
  updateTreatmentPlan,
  deleteTreatmentPlan
} from '../controller/treatmentPlanController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Preview endpoints (Preview button in mobile app)
router.post('/preview', protect, previewTreatmentPlan);
router.get('/:id/preview', protect, getExistingTreatmentPlanPreview);

// Standard CRUD endpoints (Submit button in mobile app)
router
  .route('/')
  .get(protect, getAllTreatmentPlans)
  .post(protect, createTreatmentPlan);

router
  .route('/:id')
  .get(protect, getTreatmentPlanById)
  .put(protect, updateTreatmentPlan)
  .patch(protect, updateTreatmentPlan)
  .delete(protect, deleteTreatmentPlan);

export default router;
