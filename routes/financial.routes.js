const express = require('express');
const {
  getBills,
  getBill,
  createBill,
  updateBill,
  addPayment,
  getFinancialReports,
  downloadInvoicePDF,
  sendInvoiceByEmail,
  getUnpaidBillings,
  createPaymentIntent,
} = require('../controllers/financial.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const advancedResults = require('../utils/advancedResults');
const Billing = require('../models/billing.model');

const router = express.Router();

router.use(protect);

router
  .route('/bills')
  .get(
    advancedResults(Billing, { path: 'patient', select: 'firstName lastName name medicalRecordNumber' }),
    getBills
  )
  .post(authorize('admin', 'accountant'), createBill);

router.get('/reports', authorize('admin', 'accountant'), getFinancialReports);
router.get('/unpaid', protect, authorize('admin', 'staff'), getUnpaidBillings);

router.post('/bills/:id/payments', authorize('admin', 'accountant'), addPayment);
router.post('/bills/:id/payments/intent', authorize('admin', 'accountant'), createPaymentIntent);

router
.route('/bills/:invoiceId/send')
.post(authorize('admin', 'accountant'), sendInvoiceByEmail);

router
  .route('/bills/:id')
  .get(getBill)
  .put(authorize('admin', 'accountant'), updateBill);

router
  .route('/bills/:invoiceId/pdf')
  .get(downloadInvoicePDF);



module.exports = router;