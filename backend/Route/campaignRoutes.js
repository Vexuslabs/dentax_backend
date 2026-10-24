import express from 'express';
import {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign
} from '../controller/campaignController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(upload.single('logo'), createCampaign)
  .get(getAllCampaigns);

router.route('/:id')
  .get(getCampaignById)
  .put(upload.single('logo'), updateCampaign)
  .delete(deleteCampaign);

export default router;
