import express from 'express';
import {
  createAppointment,
  getAllAppointments,
  getTodaysAppointments,
  getMissedAppointments,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
} from '../controller/appointmentController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuth);

// Specialized endpoints
router.get('/today', getTodaysAppointments);
router.get('/missed', getMissedAppointments);
router.patch('/:id/status', updateAppointmentStatus);

// Standard CRUD
router.route('/')
  .post(createAppointment)
  .get(getAllAppointments);

router.route('/:id')
  .get(getAppointmentById)
  .delete(deleteAppointment);

export default router;
