const express = require('express');
const {
  getClaims,
  getClaim,
  createClaimFromBilling,
  updateClaimStatus,
  deleteClaim,
  getClaimStats,
  seedClaims
} = require('../controllers/claim.controller');

const router = express.Router();

const { protect, authorize } = require('../middlewares/auth.middleware');

router
  .route('/')
  .get(protect, getClaims);

router
  .route('/stats')
  .get(protect, getClaimStats);

router
  .route('/from-billing/:billingId')
  .post(protect, createClaimFromBilling);

router
  .route('/:id/status')
  .put(protect, updateClaimStatus);

router
  .route('/:id')
  .get(protect, getClaim)
  .delete(protect, authorize('admin'), deleteClaim);

router
  .route('/seed')
  .post(protect, authorize('admin'), seedClaims);

module.exports = router;