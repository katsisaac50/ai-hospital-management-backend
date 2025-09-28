const express = require('express');
const {
  createEncounter,
  updateEncounter,
  deleteEncounter,
  restoreEncounter,
  getEncounters,
  getEncounter
} = require('../controllers/encounter.controller');

const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');

router
  .route('/patient/:patientId')
  .post(protect, authorize('admin'), createEncounter)
  .get(protect, authorize('admin'), getEncounters);

router
  .route('/:encounterId')
  .delete(protect, authorize('admin'), deleteEncounter);

router
  .route('/:patientId/:encounterId')
  .put(protect, updateEncounter)

router
  .route('/:encounterId/restore')
  .patch(protect, authorize('admin'), restoreEncounter);

module.exports = router;