const express = require('express');
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByDateRange,
} = require('../controllers/appointment.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Appointment = require('../models/appointment.model');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(
    advancedResults(Appointment, [
      { path: 'patient', select: 'firstName lastName' },
      { path: 'doctor', select: 'firstName lastName' },
    ]),
    getAppointments
  )
  .post(authorize('admin', 'doctor', 'receptionist'), createAppointment);
  
router.get('/range/:start/:end', getAppointmentsByDateRange);

router
  .route('/:id')
  .get(getAppointment)
  .put(authorize('admin', 'doctor', 'receptionist'), updateAppointment)
  .delete(authorize('admin'), deleteAppointment);



module.exports = router;