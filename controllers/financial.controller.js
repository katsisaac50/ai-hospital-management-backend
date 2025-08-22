const Billing = require('../models/billing.model');
const ErrorResponse = require('../utils/ErrorResponse');
const asyncHandler = require('../utils/async');
const currencyUtils = require('../utils/currency.utils');
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const EmailSender = require("../services/emailSender");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require("path");
// const fs = require("fs");
const fs = require('fs').promises;


// @desc    Get all billing records
// @route   GET /api/v1/financial/bills
// @access  Private
exports.getBills = asyncHandler(async (req, res, next) => {
  console.log("Fetching all bills", res.advancedResults);
  const bills = res.advancedResults.data.map(bill => {
    const billObj = bill.toObject();
    
    // Manually apply conversion if getters aren't working
    return {
      ...billObj,
      total: currencyUtils.fromStorageFormat(billObj.total, billObj.currency),
      subtotal: currencyUtils.fromStorageFormat(billObj.subtotal, billObj.currency),
      items: billObj.items.map(item => ({
        ...item,
        unitPrice: currencyUtils.fromStorageFormat(item.unitPrice, billObj.currency),
        amount: currencyUtils.fromStorageFormat(item.amount, billObj.currency)
      })),
      payments: billObj.payments.map(payment => ({
        ...payment,
        amount: currencyUtils.fromStorageFormat(payment.amount, billObj.currency)
      }))
    };
  });
  console.log("Bills with getters applied:", bills);
  // res.advancedResults = await Billing.find()
  //   .populate('patient', 'firstName lastName phone')
  //   .populate('createdBy', 'name email')
  //   .populate('updatedBy', 'name email')
  //   .sort({ createdAt: -1 })
  res.status(200).json({
    ...res.advancedResults,
    data: bills
  });
});

// @desc    Get single bill
// @route   GET /api/v1/financial/bills/:id
// @access  Private
exports.getBill = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id).populate(
    'patient',
    'firstName lastName phone'
  );

  if (!bill) {
    return next(
      new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: bill,
  });
});

// @desc    Get unpaid billings
// @route   GET /api/v1/billings/unpaid
// @access  Private
exports.getUnpaidBillings = asyncHandler(async (req, res, next) => {
  const billings = await Billing.find({
    paymentStatus: { $in: ['pending', 'partial'] }
  })
  .populate('patient', 'name email phone')
  .sort({ dueDate: 1 });
  
  res.status(200).json({
    success: true,
    count: billings.length,
    data: billings
  });
});


// @desc    Create new bill
// @route   POST /api/v1/financial/bills
// @access  Private
exports.createBill = asyncHandler(async (req, res) => {
  console.log('here billing', req.body);
  const { currency = 'USD', items, tax = 0, discount = 0, ...rest } = req.body;

  // MANUALLY convert all amounts to storage format since setters don't work during create()
  const formattedItems = items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: currencyUtils.toStorageFormat(item.unitPrice, currency),
    amount: currencyUtils.toStorageFormat(item.quantity * item.unitPrice, currency)
  }));

  const subtotalDisplay = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalDisplay = subtotalDisplay + tax - discount;

  const invoice = await Billing.create({
    ...rest,
    currency: currency.toUpperCase(),
    items: formattedItems,
    subtotal: currencyUtils.toStorageFormat(subtotalDisplay, currency),
    tax: currencyUtils.toStorageFormat(tax, currency),
    discount: currencyUtils.toStorageFormat(discount, currency),
    total: currencyUtils.toStorageFormat(totalDisplay, currency),
    createdBy: req.user._id
  });

  console.log('Invoice created successfully:');
  console.log('Input unitPrice:', items[0].unitPrice);
  console.log('Stored unitPrice (storage):', invoice.items[0].unitPrice);
  console.log('Display unitPrice (getter):', invoice.toObject().items[0].unitPrice);

  res.status(201).json({
    success: true,
    data: invoice,
  });
});

// // @desc    Create new bill
// // @route   POST /api/v1/financial/bills
// // @access  Private
// exports.createBill = asyncHandler(async (req, res) => {
//   console.log('here billing', req.body)
//   const invoice = await Billing.create({
//     ...req.body,
//     createdBy: req.user._id, // Assuming auth middleware
//   });

//   res.status(201).json({
//     success: true,
//     data: invoice,
//   });
// });


// @desc    Update bill
// @route   PUT /api/v1/financial/bills/:id
// @access  Private
exports.updateBill = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!bill) {
    return next(
      new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: bill,
  });
});

// @desc    Add payment to bill
// @route   POST /api/v1/financial/bills/:id/payments
// @access  Private
exports.addPayment = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id);

  if (!bill) {
    return next(
      new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404)
    );
  }

  bill.payments.push(req.body);

  // Update payment status
  const totalPaid = bill.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (totalPaid >= bill.total) {
    bill.paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    bill.paymentStatus = 'partial';
  }

  await bill.save();

  res.status(200).json({
    success: true,
    data: bill,
  });
});

// @desc    Create payment intent
// @route   POST /api/v1/finincial/:id/payments/intent
// @access  Private
exports.createPaymentIntent = asyncHandler(async (req, res, next) => {
  const billing = await Billing.findById(req.params.id)
    .populate('patient');
  
  if (!billing) {
    return next(new ErrorResponse(`Billing not found with id of ${req.params.id}`, 404));
  }
  
  if (billing.status === 'paid') {
    return next(new ErrorResponse('This invoice has already been paid', 400));
  }
  
  const amount = req.body.amount || billing.balanceDue;
  
  if (amount > billing.balanceDue) {
    return next(new ErrorResponse(
      `Payment amount exceeds balance due of ${billing.balanceDue.toFixed(2)}`,
      400
    ));
  }
  console.log('billing', billing)

  try {
    // Create real Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Amount in cents
      currency: 'usd',
      // payment_method_types: ['card'],
      metadata: {
        billingId: billing._id.toString(),
        patientId: billing.patient._id.toString(),
        invoiceNumber: billing.invoiceNumber
      },
      description: `Payment for invoice ${billing.invoiceNumber}`,
      receipt_email: billing.patient.email, // Send receipt to patient
      statement_descriptor_suffix: billing.invoiceNumber 
  ? billing.invoiceNumber.substring(0, 10) 
  : 'HOSPITAL'
    });

    res.status(200).json({
      success: true,
      data: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        invoiceNumber: billing.invoiceNumber,
        patientName: billing.patient.name
      }
    });
    
  } catch (err) {
    console.error('Error creating PaymentIntent:', err);
    return next(new ErrorResponse('Error processing payment', 500));
  }
});

// @desc    Get financial reports
// @route   GET /api/v1/financial/reports
// @access  Private
exports.getFinancialReports = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchCriteria = {};
  if (startDate && endDate) {
    matchCriteria.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const reports = await Billing.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        totalPaid: {
          $sum: {
            $reduce: {
              input: '$payments',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.amount'] },
            },
          },
        },
        outstandingBalance: {
          $sum: {
            $subtract: [
              '$total',
              {
                $reduce: {
                  input: '$payments',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.amount'] },
                },
              },
            ],
          },
        },
        billCount: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: reports[0] || {
      totalRevenue: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      billCount: 0,
    },
  });
});


// @desc    Download invoice PDF
// @route   GET /api/v1/financial/bills/:id/pdf
// @access  Private

exports.downloadInvoicePDF = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const invoice = await Billing.findById(invoiceId).populate('patient');
  if (!invoice) {
    res.status(404);
    throw new Error("Invoice not found");
  }

  const outputPath = path.join(__dirname, `../invoices/${invoice.invoiceNumber}.pdf`);
  await generateInvoicePDF(invoice, outputPath);

  res.download(outputPath, `${invoice.invoiceNumber}.pdf`, (err) => {
    if (err) console.error("Download error:", err);
    fs.unlink(outputPath, () => {}); // Delete file after download
  });
});

// exports.downloadInvoicePDF = asyncHandler(async (req, res, next) => {
//   const bill = await Billing.findById(req.params.id).populate('patient', 'firstName lastName phone');

//   if (!bill) {
//     return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
//   }

//   const invoice = await generateInvoicePDF(bill);

//   res.status(200).json({
//     success: true,
//     data: `data:application/pdf;base64,${invoice.toString('base64')}`,
//   });
// });

// @desc    send invoice PDF to patient and insurance if applicable
// @route   POST /api/v1/financial/bills/:id/send
// @access  Private

exports.sendInvoiceByEmail = asyncHandler(async (req, res, next) => {
  const { invoiceId } = req.params;
  
  try {
    // 1. Fetch invoice with patient data
    const invoice = await Billing.findById(invoiceId).populate('patient');
    if (!invoice) {
      return next(new ErrorResponse(`Invoice not found with id of ${invoiceId}`, 404));
    }

    // 2. Validate patient email
    if (!invoice.patient?.email) {
      return next(new ErrorResponse('Patient email address not found', 400));
    }

    // 3. Generate PDF
    const outputDir = path.join(__dirname, '../invoices');
    const outputPath = path.join(outputDir, `${invoice.invoiceNumber}.pdf`);
    
    // Ensure directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    await generateInvoicePDF(invoice, outputPath);

    // 4. Send email with attachment
    await EmailSender.send({
      to: invoice.patient.email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      text: `Dear ${invoice.patient.firstName},\n\nPlease find attached your invoice.\n\nThank you!`,
      attachments: [{
        filename: `${invoice.invoiceNumber}.pdf`,
        path: outputPath
      }]
    });

    // 5. Clean up - delete the temporary file
    try {
      await fs.unlink(outputPath);
    } catch (unlinkError) {
      console.warn(`Warning: Could not delete temporary file ${outputPath}`, unlinkError);
      // Not critical, so we don't fail the request
    }

    // 6. Return success response
    res.status(200).json({
      success: true,
      message: 'Invoice sent successfully',
      data: {
        invoiceNumber: invoice.invoiceNumber,
        email: invoice.patient.email
      }
    });

  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in sendInvoiceByEmail:', error);
    return next(new ErrorResponse('Failed to send invoice by email', 500));
  }
});