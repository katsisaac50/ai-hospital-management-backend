const express = require('express');
const {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSchedule,
} = require('../controllers/doctor.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Doctor = require('../models/doctor.model');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(advancedResults(Doctor), getDoctors)
  .post(authorize('admin'), createDoctor);
  
router.get('/:id/schedule', getDoctorSchedule);

router
  .route('/:id')
  .get(getDoctor)
  .put(authorize('admin'), updateDoctor)
  .delete(authorize('admin'), deleteDoctor);



module.exports = router;