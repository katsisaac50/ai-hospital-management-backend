const express = require('express');
const router = express.Router();
const {
  getBills,
  getBill,
  getUnpaidBillings,
  createBill,
  updateBill,
  addPayment,
  getFinancialReports,
  downloadInvoicePDF,
  sendInvoiceByEmail,
  getBillPayments,
  updateBillStatus,
  getBillingOverview,
  checkInvoiceStatus,
} = require('../controllers/financial.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');

// All routes are protected
router.use(protect);

// Admin and finance roles can access all routes
const adminFinance = authorize('admin', 'finance');
const adminFinanceReceptionist = authorize('admin', 'finance', 'receptionist');

router.route('/bills')
  .get(adminFinanceReceptionist, getBills)
  .post(adminFinance, createBill);

router.route('/unpaid')
  .get(adminFinanceReceptionist, getUnpaidBillings);

router.route('/stats/overview')
  .get(adminFinance, getBillingOverview);

router.route('/:id')
  .get(adminFinanceReceptionist, getBill)
  .put(adminFinance, updateBill);

router.route('/:id/payments')
  .get(adminFinanceReceptionist, getBillPayments)
  .post(adminFinance, addPayment);

router.route('/:id/status')
  .patch(adminFinance, updateBillStatus);

router.route('/:id/pdf')
  .get(adminFinanceReceptionist, downloadInvoicePDF);

router.route('/:id/send')
  .post(adminFinanceReceptionist, sendInvoiceByEmail);

router.route('/reports/financial')
  .get(adminFinance, getFinancialReports);

router
  .route('/bills/prescription/:prescriptionId')
  .get(authorize('admin', 'pharmacist'), checkInvoiceStatus)

module.exports = router;