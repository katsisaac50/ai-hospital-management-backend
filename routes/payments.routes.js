const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPayment,
  createPaymentIntent,
  initiateMobilePay,
  initiateMobileMoney,
  verifyPayment,
  stripeWebhook,
  mobilePayWebhook,
  mpesaWebhook,
  validateApplePayMerchant,
  processApplePay,
  createManualPayment,
  getPaymentStats,
  refundPayment,
  updatePaymentStatus
} = require('../controllers/payment.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');

// Public webhook endpoints (no auth required)
router.post('/webhook/stripe', stripeWebhook);
router.post('/webhook/mobilepay', mobilePayWebhook);
router.post('/webhook/mpesa', mpesaWebhook);

// Protected routes
router.use(protect);

router.route('/')
  .get(authorize('admin', 'finance'), getPayments);

router.route('/stats')
  .get(authorize('admin', 'finance'), getPaymentStats);

router.route('/:id/payments/intent')
  .post(authorize('admin', 'finance', 'receptionist'), createPaymentIntent);

router.route('/mobilepay/initiate')
  .post(authorize('admin', 'finance', 'receptionist'), initiateMobilePay);

router.route('/mobilemoney/initiate')
  .post(authorize('admin', 'finance', 'receptionist'), initiateMobileMoney);

router.route('/applepay/validate')
  .post(authorize('admin', 'finance', 'receptionist'), validateApplePayMerchant);

router.route('/applepay/process')
  .post(authorize('admin', 'finance', 'receptionist'), processApplePay);

router.route('/verify-payment')
  .post(authorize('admin', 'finance', 'receptionist'), verifyPayment);

router.route('/manual')
  .post(authorize('admin', 'finance', 'receptionist'), createManualPayment);

router.route('/:id')
  .get(authorize('admin', 'finance', 'receptionist'), getPayment);

router.route('/:id/refund')
  .post(authorize('admin', 'finance'), refundPayment);

router.route('/:id/status')
  .patch(authorize('admin', 'finance'), updatePaymentStatus);
// router.route('/pending')
//   .get(authorize('admin', 'accountant', 'staff'), getPendingPayments);
// router.route('/:id/status')
//   .get(authorize('admin', 'accountant', 'staff', 'patient'), getPaymentStatus);
// router.route('/:id/retry')
//   .post(authorize('admin', 'accountant', 'staff', 'patient'), retryPayment);
// router.route('/:id/cancel')
//   .post(authorize('admin', 'accountant', 'staff', 'patient'), cancelPayment);
// router.route('/cleanup/expired')
//   .post(authorize('admin'), cleanupExpiredPayments);

module.exports = router;



// const express = require('express');
// const {
//   getPayments,
//   getPayment,
//   createPayment,
//   createPaymentIntent,
//   stripeWebhook,
//   seedPayments,
//   verifyPayment,
// } = require('../controllers/payment.controller');
// const { protect, authorize } = require('../middlewares/auth.middleware');

// const router = express.Router();

// // Standard routes
// router.route('/')
//   .get(protect, authorize('admin', 'staff'), getPayments)
//   .post(protect, authorize('admin', 'staff'), createPayment);

// router.route('/:id')
//   .get(protect, authorize('admin', 'staff'), getPayment);

// // Payment processing routes
// router.route('/create-intent')
//   .post(protect, createPaymentIntent);

// router.route('/verify-payment')
// .post(protect, verifyPayment);

// // Webhook needs to be public (no auth)
// router.route('/webhook')
//   .post(stripeWebhook);

// // Admin routes
// router.route('/seed')
//   .post(protect, authorize('admin'), seedPayments);

// module.exports = router;