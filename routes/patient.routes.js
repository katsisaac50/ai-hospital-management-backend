const express = require('express');
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientStats,
} = require('../controllers/patient.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Patient = require('../models/patient.model');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(advancedResults(Patient), getPatients)
  .post(authorize('admin', 'doctor', 'receptionist'), createPatient);

router
.route('/stats')
.get(getPatientStats);

router
  .route('/:id')
  .get(getPatient)
  .put(authorize('admin', 'doctor', 'receptionist'), updatePatient)
  .delete(authorize('admin'), deletePatient);

module.exports = router;