const express = require('express');
const {
  getBills,
  getBill,
  createBill,
  updateBill,
  addPayment,
  getFinancialReports,
} = require('../controllers/financial.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Billing = require('../models/billing.model');

const router = express.Router();

router.use(protect);

router
  .route('/bills')
  .get(
    advancedResults(Billing, { path: 'patient', select: 'firstName lastName' }),
    getBills
  )
  .post(authorize('admin', 'accountant'), createBill);

router.get('/reports', authorize('admin', 'accountant'), getFinancialReports);

router.post('/bills/:id/payments', authorize('admin', 'accountant'), addPayment);

router
  .route('/bills/:id')
  .get(getBill)
  .put(authorize('admin', 'accountant'), updateBill);



module.exports = router;