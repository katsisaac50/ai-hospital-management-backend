const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const Payment = require('../models/payment.model');
const Patient = require('../models/patient.model');
const Billing = require('../models/billing.model');
const PaymentService = require('../services/paymentService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const currencyUtils = require('../utils/currency.utils');

// Initialize payment services
const mobilePayService = require('../services/mobilepayService');
const mobileMoneyService = require('../services/mobileMoneyService');
const applePayService = require('../services/applepayService');

// @desc    Get all payments with advanced filtering
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    sort = '-createdAt',
    method,
    status,
    patientId,
    billingId,
    startDate,
    endDate,
    provider
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (method) filter.method = method;
  if (status) filter.status = status;
  if (patientId) filter.patient = patientId;
  if (billingId) filter.billing = billingId;
  if (provider) filter['providerData.provider'] = provider;

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort,
    populate: [
      {
        path: 'patient',
        select: 'name email phone'
      },
      {
        path: 'billing',
        select: 'invoiceNumber total currency date dueDate patient'
      }
    ]
  };

  const payments = await PaymentService.getPayments(filter, options);

  res.status(200).json({
    success: true,
    count: payments.length,
    pagination: payments.pagination,
    data: payments
  });
});

// @desc    Get single payment
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = asyncHandler(async (req, res, next) => {
  const payment = await PaymentService.findPaymentById(req.params.id);

  if (!payment) {
    return next(
      new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Create payment intent for card payments
// @route   POST /api/v1/payments/:id/payments/intent
// @access  Private
exports.createPaymentIntent = asyncHandler(async (req, res, next) => {
  const billingId = req.params.id
  const { amount, currency = 'USD' } = req.body;

  // Validate billing exists
  const billing = await Billing.findById(billingId);
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  // Validate amount
  const balanceDue = billing.getBalanceDue();
  if (amount > balanceDue + 0.01) { // Allow small rounding differences
    return next(
      new ErrorResponse(`Payment amount exceeds balance due of ${balanceDue}`, 400)
    );
  }

  try{
     // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);

     // Create payment intent with Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    automatic_payment_methods: {
        enabled: true,
      },
    // payment_method_types: ['card'],
    metadata: { 
      billingId: billingId.toString(),
      patientId: billing.patient._id.toString(),
      invoiceNumber: billing.invoiceNumber
    },
    description: `Payment for invoice ${billing.invoiceNumber}`,
    receipt_email: billing.patient.email, // Send receipt to patient
    statement_descriptor_suffix: billing.invoiceNumber 
    ? billing.invoiceNumber.substring(0, 10) 
    : 'HOSPITAL'
  });

  console.log('amount', amount, 'paymentIntent', paymentIntent);
  // Create pending payment record
  const payment = await PaymentService.createPayment({
    billing: billingId,
    patient: billing.patient,
    invoiceNumber: billing.invoiceNumber,
    amount: amountInCents,
    currency,
    method: 'card',
    status: 'pending',
    providerData: {
      provider: 'stripe',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    }
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment._id,
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      invoiceNumber: billing.invoiceNumber,
      patientName: billing.patient.name,
      // Include the payment method types used for frontend guidance
      paymentMethodTypes: paymentIntent.payment_method_types
    }
  });

  }catch (err) {
    console.error('Error creating PaymentIntent:', err);
    return next(new ErrorResponse('Error processing payment', 500));
  }
});

// @desc    Initiate MobilePay payment
// @route   POST /api/v1/payments/mobilepay/initiate
// @access  Private
exports.initiateMobilePay = asyncHandler(async (req, res, next) => {
  const { billingId, amount, phoneNumber } = req.body;

  // Validate billing exists
  const billing = await Billing.findById(billingId);
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  // Validate amount
  const balanceDue = billing.getBalanceDue();
  if (amount > balanceDue + 0.01) {
    return next(
      new ErrorResponse(`Payment amount exceeds balance due of ${balanceDue}`, 400)
    );
  }

  // Create payment order with MobilePay
  const orderId = `INV-${billing.invoiceNumber}-${Date.now()}`;
  const paymentData = await mobilePayService.createPayment(
    amount,
    orderId,
    `Payment for invoice ${billing.invoiceNumber}`
  );

  // Create pending payment record
  const payment = await PaymentService.createPayment({
    billing: billingId,
    patient: billing.patient,
    invoiceNumber: billing.invoiceNumber,
    amount,
    currency: billing.currency,
    method: 'mobilepay',
    status: 'pending',
    providerData: {
      provider: 'mobilepay',
      paymentId: paymentData.paymentId,
      redirectUrl: paymentData.redirectUrl,
      phoneNumber: phoneNumber
    }
  });

  res.status(200).json({
    success: true,
    data: {
      paymentId: payment._id,
      redirectUrl: paymentData.redirectUrl,
      qrCode: paymentData.qrCode // If available
    }
  });
});

// @desc    Initiate mobile money payment
// @route   POST /api/v1/payments/mobilemoney/initiate
// @access  Private
exports.initiateMobileMoney = asyncHandler(async (req, res, next) => {
  const { billingId, amount, provider, phoneNumber } = req.body;

  // Validate billing exists
  const billing = await Billing.findById(billingId);
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  // Validate provider
  const validProviders = ['mpesa', 'airtel', 'orange', 'mtn'];
  if (!validProviders.includes(provider)) {
    return next(new ErrorResponse('Invalid mobile money provider', 400));
  }

  // Validate amount
  const balanceDue = billing.getBalanceDue();
  if (amount > balanceDue + 0.01) {
    return next(
      new ErrorResponse(`Payment amount exceeds balance due of ${balanceDue}`, 400)
    );
  }

  // Initiate mobile money payment
  const reference = `INV-${billing.invoiceNumber}`;
  const paymentResult = await mobileMoneyService.initiatePayment(
    provider,
    phoneNumber,
    amount,
    reference
  );

  // Create pending payment record
  const payment = await PaymentService.createPayment({
    billing: billingId,
    patient: billing.patient,
    invoiceNumber: billing.invoiceNumber,
    amount,
    currency: billing.currency,
    method: provider,
    status: 'pending',
    providerData: {
      provider: provider,
      checkoutRequestId: paymentResult.checkoutRequestId,
      merchantRequestId: paymentResult.merchantRequestId,
      phoneNumber: phoneNumber,
      reference: reference
    }
  });

  res.status(200).json({
    success: true,
    data: {
      paymentId: payment._id,
      provider: provider,
      checkoutRequestId: paymentResult.checkoutRequestId,
      customerMessage: paymentResult.customerMessage,
      redirectUrl: paymentResult.payment_url // For providers that redirect
    }
  });
});

// @desc    Verify and process payment
// @route   POST /api/v1/payments/verify
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const { paymentId, billingId, amount, paymentIntentId, method, transactionId, provider } = req.body;
  
  console.log('Verifying payment with data:', req.body);

  try {
    let payment;

    if (paymentId) {
      // Verify by payment ID
      payment = await PaymentService.findPaymentById(paymentId);
      if (!payment) {
        return next(new ErrorResponse('Payment not found', 404));
      }
    } else if (paymentIntentId && method === 'card') {
      // Verify Stripe payment
      payment = await PaymentService.processStripePayment(paymentIntentId);
    } else if (transactionId && provider) {
      // Verify other provider payments
      payment = await PaymentService.verifyProviderPayment(provider, transactionId);
    } else if (method === 'cash' && billingId && amount) {
      // Handle cash payments - need billingId and amount
      payment = await PaymentService.verifyProviderPayment('cash', transactionId, amount, billingId);
    }else {
      return next(new ErrorResponse('Invalid verification parameters', 400));
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(new ErrorResponse(`Payment verification failed: ${error.message}`, 400));
  }
});

// @desc    Process Stripe webhook
// @route   POST /api/v1/payments/webhook/stripe
// @access  Public
exports.stripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return next(new ErrorResponse(`Webhook Error: ${err.message}`, 400));
  }

  // Process the webhook event
  const payment = await PaymentService.processWebhook('stripe', event);

  res.status(200).json({ 
    success: true,
    received: true,
    paymentId: payment?._id 
  });
});

// @desc    Process MobilePay webhook
// @route   POST /api/v1/payments/webhook/mobilepay
// @access  Public
exports.mobilePayWebhook = asyncHandler(async (req, res, next) => {
  try {
    const payment = await PaymentService.processWebhook('mobilepay', req.body);
    res.status(200).json({ 
      success: true,
      received: true,
      paymentId: payment?._id 
    });
  } catch (error) {
    next(new ErrorResponse(`MobilePay webhook processing failed: ${error.message}`, 400));
  }
});

// @desc    Process M-Pesa webhook
// @route   POST /api/v1/payments/webhook/mpesa
// @access  Public
exports.mpesaWebhook = asyncHandler(async (req, res, next) => {
  try {
    const payment = await PaymentService.processWebhook('mpesa', req.body);
    
    // M-Pesa expects specific response format
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: "Failed"
    });
  }
});

// @desc    Process Apple Pay validation
// @route   POST /api/v1/payments/applepay/validate
// @access  Private
exports.validateApplePayMerchant = asyncHandler(async (req, res, next) => {
  const { validationURL } = req.body;

  try {
    const merchantSession = await applePayService.validateMerchant(validationURL);
    res.status(200).json(merchantSession);
  } catch (error) {
    next(new ErrorResponse(`Apple Pay validation failed: ${error.message}`, 400));
  }
});

// @desc    Process Apple Pay payment
// @route   POST /api/v1/payments/applepay/process
// @access  Private
exports.processApplePay = asyncHandler(async (req, res, next) => {
  const { billingId, amount, paymentToken } = req.body;

  // Validate billing exists
  const billing = await Billing.findById(billingId);
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  try {
    // Process Apple Pay payment
    const paymentResult = await applePayService.processPayment(
      paymentToken,
      amount,
      `INV-${billing.invoiceNumber}`
    );

    if (paymentResult.success) {
      // Create completed payment record
      const payment = await PaymentService.createPayment({
        billing: billingId,
        patient: billing.patient,
        invoiceNumber: billing.invoiceNumber,
        amount,
        currency: billing.currency,
        method: 'applepay',
        status: 'completed',
        transactionId: paymentResult.transactionId,
        providerData: {
          provider: 'applepay',
          transactionId: paymentResult.transactionId
        }
      });

      res.status(200).json({
        success: true,
        data: payment
      });
    } else {
      next(new ErrorResponse('Apple Pay payment failed', 400));
    }
  } catch (error) {
    next(new ErrorResponse(`Apple Pay processing failed: ${error.message}`, 400));
  }
});

// @desc    Create manual payment (cash, bank transfer, etc)
// @route   POST /api/v1/payments/manual
// @access  Private
exports.createManualPayment = asyncHandler(async (req, res, next) => {
  const { billingId, amount, method, transactionId, notes, cashReceived, changeGiven } = req.body;

  // Validate billing exists
  const billing = await Billing.findById(billingId);
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  // Validate amount
  const balanceDue = billing.getBalanceDue();
  if (amount > balanceDue + 0.01) {
    return next(
      new ErrorResponse(`Payment amount exceeds balance due of ${balanceDue}`, 400)
    );
  }

  // Validate manual payment methods
  const validManualMethods = ['cash', 'bank_transfer', 'check'];
  if (!validManualMethods.includes(method)) {
    return next(new ErrorResponse('Invalid manual payment method', 400));
  }

  // For cash payments, validate cash received
  if (method === 'cash' && cashReceived < amount) {
    return next(
      new ErrorResponse(`Cash received (${cashReceived}) is less than payment amount (${amount})`, 400)
    );
  }

  // Create payment record
  const paymentData = {
    billing: billingId,
    patient: billing.patient,
    invoiceNumber: billing.invoiceNumber,
    amount,
    currency: billing.currency,
    method,
    status: 'completed',
    transactionId: transactionId || `MANUAL-${Date.now()}`,
    notes,
    providerData: {}
  };

  // Add cash-specific data
  if (method === 'cash') {
    paymentData.providerData.cashReceived = cashReceived;
    paymentData.providerData.changeGiven = changeGiven || 0;
  }

  const payment = await PaymentService.createPayment(paymentData);

  res.status(201).json({
    success: true,
    data: payment
  });
});

// @desc    Get payment statistics
// @route   GET /api/v1/payments/stats
// @access  Private
exports.getPaymentStats = asyncHandler(async (req, res, next) => {
  const { timeframe = 'month', startDate, endDate } = req.query;

  let stats;
  
  if (startDate || endDate) {
    // Custom date range
    const filters = {};
    if (startDate) filters.$gte = new Date(startDate);
    if (endDate) filters.$lte = new Date(endDate);
    
    stats = await PaymentService.getPaymentStatsByDateRange(filters);
  } else {
    // Predefined timeframe
    stats = await PaymentService.getPaymentStats(timeframe);
  }

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Refund payment
// @route   POST /api/v1/payments/:id/refund
// @access  Private
exports.refundPayment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { reason, amount } = req.body;

  const payment = await PaymentService.findPaymentById(id);
  if (!payment) {
    return next(new ErrorResponse('Payment not found', 404));
  }

  // Validate refund amount
  const refundAmount = amount || payment.amount;
  if (refundAmount > payment.amount) {
    return next(
      new ErrorResponse(`Refund amount cannot exceed original payment amount of ${payment.amount}`, 400)
    );
  }

  // Process refund based on payment method
  let refundResult;
  try {
    switch (payment.method) {
      case 'card':
        refundResult = await stripe.refunds.create({
          payment_intent: payment.providerData.paymentIntentId,
          amount: Math.round(refundAmount * 100)
        });
        break;
      
      case 'mobilepay':
        refundResult = await mobilePayService.createRefund(
          payment.providerData.paymentId,
          refundAmount
        );
        break;
      
      default:
        // For cash and other methods, just record the refund
        refundResult = { id: `REFUND-${Date.now()}` };
    }

    // Update payment status to refunded
    payment.status = 'refunded';
    payment.notes = payment.notes ? `${payment.notes}\nRefund: ${reason}` : `Refund: ${reason}`;
    payment.refundData = {
      refundId: refundResult.id,
      amount: refundAmount,
      reason: reason,
      processedAt: new Date()
    };

    await payment.save();

    res.status(200).json({
      success: true,
      data: {
        refundId: refundResult.id,
        amount: refundAmount,
        payment: payment
      }
    });

  } catch (error) {
    next(new ErrorResponse(`Refund failed: ${error.message}`, 400));
  }
});

// @desc    Update payment status
// @route   PATCH /api/v1/payments/:id/status
// @access  Private
exports.updatePaymentStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse('Invalid status value', 400));
  }

  const payment = await PaymentService.updatePaymentStatus(id, status, notes);

  res.status(200).json({
    success: true,
    data: payment
  });
});


// @desc    Get pending payments
// @route   GET /api/v1/payments/pending
// @access  Private
exports.getPendingPayments = asyncHandler(async (req, res, next) => {
  const { patientId, billingId, method } = req.query;
  
  const filters = {};
  if (patientId) filters.patient = patientId;
  if (billingId) filters.billing = billingId;
  if (method) filters.method = method;
  
  const payments = await PendingPaymentService.getPendingPayments(filters);
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Get payment status
// @route   GET /api/v1/payments/:id/status
// @access  Private
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const paymentId = req.params.id;
  
  const status = await PendingPaymentService.getPaymentStatus(paymentId);
  
  res.status(200).json({
    success: true,
    data: status
  });
});

// @desc    Retry payment
// @route   POST /api/v1/payments/:id/retry
// @access  Private
exports.retryPayment = asyncHandler(async (req, res, next) => {
  const paymentId = req.params.id;
  
  const result = await PendingPaymentService.retryPayment(paymentId);
  
  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Cancel payment
// @route   POST /api/v1/payments/:id/cancel
// @access  Private
exports.cancelPayment = asyncHandler(async (req, res, next) => {
  const paymentId = req.params.id;
  const { reason } = req.body;
  
  const payment = await PendingPaymentService.cancelPayment(paymentId, reason);
  
  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Cleanup expired payments (admin only)
// @route   POST /api/v1/payments/cleanup/expired
// @access  Private/Admin
exports.cleanupExpiredPayments = asyncHandler(async (req, res, next) => {
  const result = await PendingPaymentService.cleanupExpiredPayments();
  
  res.status(200).json({
    success: true,
    data: result
  });
});