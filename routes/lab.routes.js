const express = require('express');
const {
  getLabTests,
  getLabTest,
  createLabTest,
  updateLabTest,
  deleteLabTest,
  getTestsByCategory,
} = require('../controllers/lab.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const LabTest = require('../models/labTest.model');

const router = express.Router();

router.use(protect);

router
  .route('/tests')
  .get(advancedResults(LabTest), getLabTests)
  .post(authorize('admin', 'lab_technician'), createLabTest);

router.get('/tests/category/:category', getTestsByCategory);

router
  .route('/tests/:id')
  .get(getLabTest)
  .put(authorize('admin', 'lab_technician'), updateLabTest)
  .delete(authorize('admin'), deleteLabTest);

module.exports = router;