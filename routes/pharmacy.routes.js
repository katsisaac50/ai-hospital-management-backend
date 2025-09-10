const express = require('express');
const {
  // getAll,
  // getOne,
  // createOne,
  // updateOne,
  // deleteOne,
  getLowStockMedications,
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
} = require('../controllers/pharmacy.controller');
const {
  createPrescription,
  getPrescriptions,
  getPrescription,
  getPharmacyActivities,
  updatePrescription,
  deletePrescription,
  processPrescription,
  dispensePrescription,
  billingPrescription,
} = require('../controllers/prescription.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Medication = require('../models/medication.model');
const Prescription = require('../models/prescription.model');

const router = express.Router();

router.use(protect);

// GET /api/v1/pharmacy/activities
router.get('/activities', getPharmacyActivities);


router
  .route('/medications')
  .get(advancedResults(Medication), getMedications)
  .post(authorize('admin', 'pharmacist'), createMedication);

router.get('/medications/low-stock', getLowStockMedications);

router
  .route('/medications/:id')
  .get(getMedication)
  .put(authorize('admin', 'pharmacist'), updateMedication)
  .delete(authorize('admin'), deleteMedication);

// router.route("/:storeName").get(getAll).post(createOne);
// router.route("/:storeName/:id").get(getOne).put(updateOne).delete(deleteOne);

router
  .route('/prescriptions')
  .get(advancedResults(Prescription, [
    { path: "patient", select: "name fullName medicalRecordNumber insurance" },
    { path: 'doctor', select: 'firstName lastName fullName email' },
    { path: 'medications', match: { isActive: true }, select: "name strength price" }
  ]),getPrescriptions)
  .post(authorize('admin', 'pharmacist'), createPrescription)
  // .put(authorize('admin', 'pharmacist'), updatePrescription)
  

router
  .route('/prescriptions/:id')
  .get(getPrescription)
  .put(authorize('admin', 'pharmacist'), updatePrescription)
  .delete(authorize('admin'), deletePrescription);

router
  .route('/prescriptions/process/:id')
  .put(authorize('admin', 'pharmacist'), processPrescription)

router
  .route('/prescriptions/dispense/:id')
  .put(authorize('admin', 'pharmacist'), dispensePrescription)

router
  .route('/prescriptions/patient/:id')
  .get(authorize('admin', 'pharmacist'), billingPrescription)

module.exports = router;