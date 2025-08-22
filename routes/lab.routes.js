const express = require('express');
const {
  getLabTests,
  getLabTest,
  createLabTest,
  updateLabTest,
  deleteLabTest,
  getTestsByCategory,
  
} = require('../controllers/lab.controller');
const  { 
  getEquipment,
  createEquipment,} = require('../controllers/equipment.controller')
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const LabTest = require('../models/labTest.model');
const { sendLabTestCompletionEmail } = require('../services/emailService');
const Patient = require('../models/patient.model');
const User = require('../models/user.model');

const router = express.Router();

router.use(protect);

// Get all lab tests
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

router.put('/:id/status', async (req, res) => {
  try {
    const { status, completedBy } = req.body;

    const labTest = await LabTest.findById(req.params.id)
      .populate('patientId')
      .populate('orderedById');

    if (!labTest) {
      return res.status(404).json({ message: 'Lab test not found' });
    }

    labTest.status = status;
    if (status === 'completed') {
      labTest.completedDate = new Date();
      labTest.completedBy = completedBy;

      await labTest.save();

      // Send email to doctor
      if (labTest.orderedById?.email) {
        await sendLabTestCompletionEmail({
          to: labTest.orderedById.email,
          patientName: labTest.patientName,
          testType: labTest.testType,
          labNumber: labTest.LaboratoryRecordNumber,
          completedDate: labTest.completedDate
        });
      }

      // Send email to patient (optional)
      if (labTest.patientId?.email) {
        await sendLabTestCompletionEmail({
          to: labTest.patientId.email,
          patientName: labTest.patientName,
          testType: labTest.testType,
          labNumber: labTest.LaboratoryRecordNumber,
          completedDate: labTest.completedDate
        });
      }
    } else {
      await labTest.save();
    }

    res.json({ message: 'Lab test updated successfully', labTest });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

  router
  .route('/equipment')
  .get(getEquipment) // Assuming you have a getEquipment controller
  .post(authorize('admin', 'lab_technician'), createEquipment); // Assuming you have a createEquipment controller

// Add any additional routes for lab equipment or other functionalities here
// e.g., router.route('/equipment/:id').get(getEquipmentById).put(updateEquipment).delete(deleteEquipment);

module.exports = router;