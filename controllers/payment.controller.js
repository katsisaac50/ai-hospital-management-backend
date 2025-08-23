const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const Payment = require('../models/payment.model');
const Patient = require('../models/patient.model');
const Billing = require('../models/billing.model');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const currencyUtils = require('../utils/currency.utils')

// @desc    Get all payments
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = asyncHandler(async (req, res, next) => {
  // Advanced filtering, sorting, pagination
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  console.log('hheh', reqQuery)

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource with population
  query = Payment.find(JSON.parse(queryStr))
  .populate([
    {
      path: 'patient',
      select: 'name email phone'
    },
    {
      path: 'billing',
      select: 'invoiceNumber total currency date dueDate',
      populate: {
        path: 'payments',
        select: 'amount method date'
      }
    }
  ])
  .setOptions({ 
    getters: true,
    // Enable virtuals if needed
    virtuals: true 
  });

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-date');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Payment.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const payments = await query;

  // If getters still don't work, use manual conversion:
  // const formattedPayments = payments.map(payment => ({
  //   ...payment.toObject(),
  //   amount: currencyUtils.fromStorageFormat(payment.amount, payment.currency)
  // }));
  const formattedPayments = payments.map(payment => {
    // Access currency through the populated billing reference
    const currency = payment.billing?.currency || 'USD';
    
    return {
      ...payment.toObject(),
      amount: currencyUtils.fromStorageFormat(payment.amount, currency),
      currency // Include currency in response
    };
  });


  // Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  console.log('payments', formattedPayments)

  res.status(200).json({
    success: true,
    count: payments.length,
    pagination,
    data: formattedPayments || payments
  });
});

// @desc    Get single payment
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate({
    path: 'patient',
    select: 'name email phone'
  });

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

// @desc    Create new payment intent
// @route   POST /api/v1/payments/create-intent
// @access  Private
exports.createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { amount, patientId, paymentMethod } = req.body;

  // Validate patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return next(
      new ErrorResponse(`Patient not found with id of ${patientId}`, 404)
    );
  }

  // Validate amount
  if (amount < 1) {
    return next(
      new ErrorResponse('Amount must be at least $1', 400)
    );
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    payment_method_types: ['card', 'us_bank_account', 'link', 'mobile_money'],
    metadata: { patientId }
  });

  res.status(200).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id
  });
});

// @desc    Verify payment status and update billing record
// @route   POST /api/v1/payments/verify-payment
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    // Validate input
    if (!paymentIntentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Payment intent ID is required' 
      });
    }

    // 1. Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('Payment Intent:', paymentIntent);

    const billingId = paymentIntent.metadata.billingId;
    if (!billingId) {
      return res.status(400).json({
        success: false,
        error: 'No billing ID found in payment intent metadata'
      });
    }

    const billing = await Billing.findById(billingId);
    if (!billing) {
      return res.status(404).json({
        success: false,
        error: 'Billing record not found'
      });
    }

    let paymentStatus;
    if (paymentIntent.status === 'succeeded') {
      const amountPaid = paymentIntent.amount_received || paymentIntent.amount;
      console.log('amountPaid', amountPaid, 'billing.amount', billing)
      paymentStatus = amountPaid >= billing.amount ? 'paid' : 'partial';
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Payment not successful',
        status: paymentIntent.status 
      });
    }
    // if (paymentIntent.status !== 'succeeded') {
    //   return res.status(400).json({ 
    //     success: false,
    //     error: 'Payment not successful',
    //     status: paymentIntent.status 
    //   });
    // }

    // 2. Get billing ID from metadata
    // const billingId = paymentIntent.metadata.billingId;
    // if (!billingId) {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'No billing ID found in payment intent metadata'
    //   });
    // }

    // 3. Update billing record
    const updatedBilling = await updateBillingPaymentStatus(billingId, paymentIntent, paymentStatus);

    res.status(200).json({ 
      success: true,
      data: {
        status: paymentStatus,
        verified: true,
        billingId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Payment verification failed',
      message: error.message 
    });
  }
});

// Helper function to update billing payment status
const updateBillingPaymentStatus = async (billingId, paymentIntent) => {
  try {
    const updateData = {
      paymentStatus: 'paid',
      paymentDate: new Date(),
      paymentMethod: paymentIntent.payment_method_types[0],
      paymentIntentId: paymentIntent.id
    };

    const updatedBilling = await Billing.findByIdAndUpdate(
      billingId,
      updateData,
      { new: true }
    );

    if (!updatedBilling) {
      throw new Error('Billing record not found');
    }
console.log('Updated Billing:', updatedBilling);

    // Update patient balance if necessary
    if (updatedBilling.patient) {
      await Patient.findByIdAndUpdate(
        updatedBilling.patient,
        { $inc: { balance: -paymentIntent.amount / 100 } }, // Convert cents to dollars
        { new: true }
      );
    }
    // Update customer status if billing has a customer reference
    // if (updatedBilling.customerId) {
    //   await Customer.findByIdAndUpdate(
    //     updatedBilling.customerId,
    //     { hasOutstandingBalance: false }
    //   );
    // }

    // Create payment record for history
    await Payment.create({
      billing: billingId,
      patient: updatedBilling.patient,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'Completed',
      method: paymentIntent.payment_method_types[0]
    });

    return updatedBilling;
  } catch (error) {
    console.error('Error updating billing payment status:', error);
    throw error;
  }
};

// @desc    Create manual payment (for cash, bank transfer, etc)
// @route   POST /api/v1/payments
// @access  Private
exports.createPayment = asyncHandler(async (req, res, next) => {
  const { billingId } = req.params;
  const billing = await Billing.findById(billingId);
  
  if (!billing) {
    return next(new ErrorResponse('Billing record not found', 404));
  }

  const payment = await billing.applyPayment(req.body);
  
  res.status(201).json({
    success: true,
    data: payment
  });
});


// exports.createPayment = asyncHandler(async (req, res, next) => {
//   // Validate patient exists
//   const patient = await Patient.findById(req.body.patient);
//   if (!patient) {
//     return next(
//       new ErrorResponse(`Patient not found with id of ${req.body.patient}`, 404)
//     );
//   }

//   // Create payment - IDs will be auto-generated by the model
//   const payment = await Payment.create({
//     patient: req.body.patient,
//     amount: req.body.amount,
//     method: req.body.method,
//     status: req.body.status || 'Completed',
//     notes: req.body.notes
//   });

//   res.status(201).json({
//     success: true,
//     data: payment
//   });
// });

// @desc    Process stripe webhook
// @route   POST /api/v1/payments/webhook
// @access  Public (Stripe needs to access this)
exports.stripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return next(new ErrorResponse(`Webhook Error: ${err.message}`, 400));
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handleSuccessfulPayment(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Helper functions
async function handleSuccessfulPayment(paymentIntent) {
  const payment = await Payment.create({
    patient: paymentIntent.metadata.patientId,
    amount: paymentIntent.amount / 100,
    method: `Stripe - ${paymentIntent.payment_method_types[0]}`,
    status: 'Completed',
    transactionId: paymentIntent.id
  });

  return payment;
}

async function handleFailedPayment(paymentIntent) {
  const payment = await Payment.create({
    patient: paymentIntent.metadata.patientId,
    amount: paymentIntent.amount / 100,
    method: `Stripe - ${paymentIntent.payment_method_types[0]}`,
    status: 'Failed',
    transactionId: paymentIntent.id
  });

  return payment;
}

// @desc    Seed payment data
// @route   POST /api/v1/payments/seed
// @access  Private/Admin
exports.seedPayments = asyncHandler(async (req, res, next) => {
  // Delete existing
  await Payment.deleteMany();

  // Create sample patients if they don't exist
  const patients = await Patient.find();
  if (patients.length === 0) {
    await Patient.create([
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '555-0101',
        insuranceProvider: 'Blue Cross',
        insuranceId: 'BC123456'
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@example.com',
        phone: '555-0102',
        insuranceProvider: 'Aetna',
        insuranceId: 'AE789012'
      },
      {
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@example.com',
        phone: '555-0103',
        insuranceProvider: 'United Health',
        insuranceId: 'UH345678'
      }
    ]);
  }

  const samplePatients = await Patient.find().limit(3);

  // Create sample payments - IDs will be auto-generated by the model
  const payments = await Payment.create([
    {
      patient: samplePatients[0]._id,
      amount: 450.75,
      method: 'Credit Card',
      status: 'Completed'
    },
    {
      patient: samplePatients[1]._id,
      amount: 1250.0,
      method: 'Insurance',
      status: 'Processing'
    },
    {
      patient: samplePatients[2]._id,
      amount: 890.25,
      method: 'Cash',
      status: 'Completed'
    }
  ]);

  res.status(200).json({
    success: true,
    data: payments
  });
});