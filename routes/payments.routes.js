const express = require('express');
const {
  getPayments,
  getPayment,
  createPayment,
  createPaymentIntent,
  stripeWebhook,
  seedPayments,
  verifyPayment,
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

// Standard routes
router.route('/')
  .get(protect, authorize('admin', 'staff'), getPayments)
  .post(protect, authorize('admin', 'staff'), createPayment);

router.route('/:id')
  .get(protect, authorize('admin', 'staff'), getPayment);

// Payment processing routes
router.route('/create-intent')
  .post(protect, createPaymentIntent);

router.route('/verify-payment')
.post(protect, verifyPayment);

// Webhook needs to be public (no auth)
router.route('/webhook')
  .post(stripeWebhook);

// Admin routes
router.route('/seed')
  .post(protect, authorize('admin'), seedPayments);

module.exports = router;