import express from 'express';
import {
  createAppointment,
  getAllAppointments,
  getTodaysAppointments,
  getUpcomingAppointments,
  getMissedAppointments,
  updateAppointment,
  updateAppointmentStatus,
  getAppointmentById,
  deleteAppointment
} from '../controller/appointmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Enforce authentication on all appointment operations
router.use(protect);

// Specialized endpoints
router.get('/today', getTodaysAppointments);
router.get('/upcoming', getUpcomingAppointments);
router.get('/missed', getMissedAppointments);
router.patch('/:id/status', updateAppointmentStatus);

// Standard CRUD
router.route('/')
  .post(createAppointment)
  .get(getAllAppointments);

router.route('/:id')
  .get(getAppointmentById)
  .put(updateAppointment)
  .patch(updateAppointment)
  .delete(deleteAppointment);

export default router;
