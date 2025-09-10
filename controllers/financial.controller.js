const Billing = require('../models/billing.model');
const Payment = require('../models/payment.model');
const Prescription = require('../models/prescription.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const currencyUtils = require('../utils/currency.utils');
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const EmailSender = require("../services/emailSender");
const PaymentService = require('../services/paymentService');
const path = require("path");
const fs = require('fs').promises;

// @desc    Get all billing records with advanced filtering
// @route   GET /api/v1/financial/bills
// @access  Private
exports.getBills = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    sort = '-createdAt',
    status,
    paymentStatus,
    patientId,
    startDate,
    endDate,
    minAmount,
    maxAmount
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (patientId) filter.patient = patientId;

  // Date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  // Amount range filter
  if (minAmount || maxAmount) {
    filter.total = {};
    if (minAmount) filter.total.$gte = currencyUtils.toStorageFormat(parseFloat(minAmount), 'USD');
    if (maxAmount) filter.total.$lte = currencyUtils.toStorageFormat(parseFloat(maxAmount), 'USD');
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort,
    populate: [
      /* {
        path: 'patient',
        select: 'firstName lastName phone email'
      }, */
      { path: 'patient', 
        select: 'firstName lastName name medicalRecordNumber'
      },
      {
        path: 'createdBy',
        select: 'name email'
      },
      {
        path: 'updatedBy',
        select: 'name email'
      }
    ]
  };

  const bills = await Billing.find(filter)
    .populate(options.populate)
    .sort(options.sort)
    .skip((options.page - 1) * options.limit)
    .limit(options.limit);

  // Get total count for pagination
  const total = await Billing.countDocuments(filter);

  // Format bills with proper currency conversion
  const formattedBills = bills.map(bill => {
    const billObj = bill.toObject();
    
    return {
      ...billObj,
      total: currencyUtils.fromStorageFormat(billObj.total, billObj.currency),
      subtotal: currencyUtils.fromStorageFormat(billObj.subtotal, billObj.currency),
      tax: currencyUtils.fromStorageFormat(billObj.tax, billObj.currency),
      discount: currencyUtils.fromStorageFormat(billObj.discount, billObj.currency),
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

  // Pagination info
  const pagination = {
    page: options.page,
    limit: options.limit,
    total,
    pages: Math.ceil(total / options.limit)
  };

  if (options.page * options.limit < total) {
    pagination.next = {
      page: options.page + 1,
      limit: options.limit
    };
  }

  if ((options.page - 1) * options.limit > 0) {
    pagination.prev = {
      page: options.page - 1,
      limit: options.limit
    };
  }

  res.status(200).json({
    success: true,
    count: formattedBills.length,
    pagination,
    data: formattedBills
  });
});

// @desc    Get single bill
// @route   GET /api/v1/financial/bills/:id
// @access  Private
exports.getBill = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id)
    .populate('patient', 'firstName lastName phone email address')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

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
// @route   GET /api/v1/financial/bills/unpaid
// @access  Private
exports.getUnpaidBillings = asyncHandler(async (req, res, next) => {
  const { patientId, overdueOnly = false } = req.query;

  const filter = {
    paymentStatus: { $in: ['pending', 'partial'] }
  };

  if (patientId) {
    filter.patient = patientId;
  }

  if (overdueOnly === 'true') {
    filter.dueDate = { $lt: new Date() };
  }

  const billings = await Billing.find(filter)
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
exports.createBill = asyncHandler(async (req, res, next) => {
  const { currency = 'USD', items, tax = 0, discount = 0, prescriptionId, ...rest } = req.body;
console.log('req.body', req.body);
  // Basic currency validation
  // const supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  // if (!supportedCurrencies.includes(currency.toUpperCase())) {
  //   return next(new ErrorResponse('Unsupported currency', 400));
  // }
  // Validate required fields
  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new ErrorResponse('Bill must have at least one item', 400));
  }

  // Validate items
  for (const item of items) {
    if (!item.description || !item.quantity || !item.unitPrice) {
      return next(new ErrorResponse('Each item must have description, quantity, and unitPrice', 400));
    }
    if (item.quantity <= 0) {
      return next(new ErrorResponse('Item quantity must be greater than 0', 400));
    }
    if (item.unitPrice <= 0) {
      return next(new ErrorResponse('Item unit price must be greater than 0', 400));
    }
  }

  // Convert all amounts to storage format
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
    prescriptionId: prescriptionId || undefined,
    createdBy: req.user._id
  });

  // Populate the created bill for response
  const populatedBill = await Billing.findById(invoice._id)
    .populate('patient', 'firstName lastName phone email')
    .populate('createdBy', 'name email')
    .populate('prescriptionId', 'prescriptionId status');

  res.status(201).json({
    success: true,
    data: populatedBill,
  });
});

// @desc    Update bill
// @route   PUT /api/v1/financial/bills/:id
// @access  Private
exports.updateBill = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id);

  if (!bill) {
    return next(
      new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404)
    );
  }

  // Prevent updating paid bills
  if (bill.paymentStatus === 'paid') {
    return next(new ErrorResponse('Cannot update a paid bill', 400));
  }

  const updatedBill = await Billing.findByIdAndUpdate(
    req.params.id, 
    {
      ...req.body,
      updatedBy: req.user._id
    }, 
    {
      new: true,
      runValidators: true,
    }
  ).populate('patient', 'firstName lastName phone email')
   .populate('updatedBy', 'name email');

  res.status(200).json({
    success: true,
    data: updatedBill,
  });
});

// @desc    Add manual payment to bill
// @route   POST /api/v1/financial/bills/:id/payments
// @access  Private
exports.addPayment = asyncHandler(async (req, res, next) => {
  const { amount, method, transactionId, notes, cashReceived, changeGiven } = req.body;

  const bill = await Billing.findById(req.params.id);
  if (!bill) {
    return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
  }

  // Validate payment amount
  const balanceDue = bill.getBalanceDue();
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

  try {
    // Create payment record through PaymentService
    const payment = await PaymentService.createPayment({
      billing: bill._id,
      patient: bill.patient,
      invoiceNumber: bill.invoiceNumber,
      amount,
      currency: bill.currency,
      method,
      status: 'completed',
      transactionId: transactionId || `MANUAL-${Date.now()}`,
      notes,
      providerData: {
        cashReceived,
        changeGiven: changeGiven || 0
      },
      processedBy: req.user._id
    });

    // The payment will automatically update the billing record via post-save hook

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    next(new ErrorResponse(`Failed to add payment: ${error.message}`, 400));
  }
});

// @desc    Get financial reports
// @route   GET /api/v1/financial/reports
// @access  Private
exports.getFinancialReports = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, groupBy = 'month' } = req.query;

  const matchCriteria = {};
  if (startDate && endDate) {
    matchCriteria.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // Group by period based on groupBy parameter
  let groupStage;
  switch (groupBy) {
    case 'day':
      groupStage = {
        $dateToString: { format: "%Y-%m-%d", date: "$date" }
      };
      break;
    case 'week':
      groupStage = {
        $dateToString: { format: "%Y-%U", date: "$date" }
      };
      break;
    case 'month':
      groupStage = {
        $dateToString: { format: "%Y-%m", date: "$date" }
      };
      break;
    case 'year':
      groupStage = {
        $dateToString: { format: "%Y", date: "$date" }
      };
      break;
    default:
      groupStage = {
        $dateToString: { format: "%Y-%m", date: "$date" }
      };
  }

  const reports = await Billing.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: groupStage,
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
        outstandingBalance: { $sum: { $subtract: ['$total', {
          $reduce: {
            input: '$payments',
            initialValue: 0,
            in: { $add: ['$$value', '$$this.amount'] },
          },
        }] } },
        billCount: { $sum: 1 },
        paidBillCount: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'paid'] },
              1,
              0
            ]
          }
        }
      },
    },
    { $sort: { _id: 1 } }
  ]);

  // Convert amounts from storage format to display format
  const formattedReports = reports.map(report => ({
    period: report._id,
    totalRevenue: currencyUtils.fromStorageFormat(report.totalRevenue, 'USD'),
    totalPaid: currencyUtils.fromStorageFormat(report.totalPaid, 'USD'),
    outstandingBalance: currencyUtils.fromStorageFormat(report.outstandingBalance, 'USD'),
    billCount: report.billCount,
    paidBillCount: report.paidBillCount
  }));

  res.status(200).json({
    success: true,
    data: formattedReports
  });
});

// @desc    Download invoice PDF
// @route   GET /api/v1/financial/bills/:id/pdf
// @access  Private
exports.downloadInvoicePDF = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id)
    .populate('patient', 'firstName lastName phone email address')
    .populate('createdBy', 'name email');

  if (!bill) {
    return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
  }

  try {
    const outputDir = path.join(__dirname, '../temp/invoices');
    const outputPath = path.join(outputDir, `${bill.invoiceNumber}.pdf`);
    
    // Ensure directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    await generateInvoicePDF(bill, outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${bill.invoiceNumber}.pdf"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up after sending
    fileStream.on('close', async () => {
      try {
        await fs.unlink(outputPath);
      } catch (unlinkError) {
        console.warn(`Could not delete temporary file: ${unlinkError.message}`);
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    next(new ErrorResponse('Failed to generate invoice PDF', 500));
  }
});

// @desc    Send invoice by email
// @route   POST /api/v1/financial/bills/:id/send
// @access  Private
exports.sendInvoiceByEmail = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id)
    .populate('patient', 'firstName lastName email phone');

  if (!bill) {
    return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
  }

  if (!bill.patient?.email) {
    return next(new ErrorResponse('Patient email address not found', 400));
  }

  try {
    const outputDir = path.join(__dirname, '../temp/invoices');
    const outputPath = path.join(outputDir, `${bill.invoiceNumber}.pdf`);
    
    // Ensure directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    await generateInvoicePDF(bill, outputPath);

    // Send email with attachment
    await EmailSender.send({
      to: bill.patient.email,
      subject: `Invoice ${bill.invoiceNumber} - ${bill.patient.firstName} ${bill.patient.lastName}`,
      text: `Dear ${bill.patient.firstName},\n\nPlease find attached your invoice ${bill.invoiceNumber}.\n\nTotal Amount: ${bill.currency} ${bill.getBalanceDue()}\nDue Date: ${bill.dueDate.toLocaleDateString()}\n\nThank you for choosing our services.\n\nBest regards,\nHealthcare Provider`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice ${bill.invoiceNumber}</h2>
          <p>Dear ${bill.patient.firstName},</p>
          <p>Please find attached your invoice.</p>
          <p><strong>Total Amount:</strong> ${bill.currency} ${bill.getBalanceDue()}</p>
          <p><strong>Due Date:</strong> ${bill.dueDate.toLocaleDateString()}</p>
          <p>Thank you for choosing our services.</p>
          <p>Best regards,<br>Healthcare Provider</p>
        </div>
      `,
      attachments: [{
        filename: `${bill.invoiceNumber}.pdf`,
        path: outputPath
      }]
    });

    // Clean up temporary file
    try {
      await fs.unlink(outputPath);
    } catch (unlinkError) {
      console.warn(`Could not delete temporary file: ${unlinkError.message}`);
    }

    // Update bill status to sent if it was draft
    if (bill.status === 'draft') {
      bill.status = 'sent';
      await bill.save();
    }

    res.status(200).json({
      success: true,
      message: 'Invoice sent successfully',
      data: {
        invoiceNumber: bill.invoiceNumber,
        email: bill.patient.email,
        patientName: `${bill.patient.firstName} ${bill.patient.lastName}`
      }
    });

  } catch (error) {
    console.error('Email sending error:', error);
    next(new ErrorResponse('Failed to send invoice by email', 500));
  }
});

// @desc    Get bill payment history
// @route   GET /api/v1/financial/bills/:id/payments
// @access  Private
exports.getBillPayments = asyncHandler(async (req, res, next) => {
  const bill = await Billing.findById(req.params.id);
  if (!bill) {
    return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
  }

  // Get payments for this bill from Payment collection
  const payments = await Payment.find({ billing: req.params.id })
    .populate('processedBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Update bill status
// @route   PATCH /api/v1/financial/bills/:id/status
// @access  Private
exports.updateBillStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse('Invalid status value', 400));
  }

  const bill = await Billing.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      updatedBy: req.user._id
    },
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName phone email')
   .populate('updatedBy', 'name email');

  if (!bill) {
    return next(new ErrorResponse(`Bill not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: bill
  });
});

// @desc    Get invoice by prescription ID
// @route   GET /api/v1/financial/bills/prescription/:prescriptionId
// @access  Private
// router.get('/prescription/:prescriptionId', protect, authorize('pharmacist', 'admin'), 
exports.checkInvoiceStatus = asyncHandler(async (req, res, next) => {
  console.log('checkInvoiceStatus called' + JSON.stringify(req.params));
  console.log('params', req.params)
  try {
    const { prescriptionId } = req.params;

    // Validate prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription not found' 
      });
    }

    // Find invoice by prescription ID
    const invoice = await Billing.findOne({ prescriptionId })
      .populate('patient', 'name email phone')
      .populate('prescriptionId', 'status totalCost');

    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        message: 'No invoice found for this prescription' 
      });
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching invoice' 
    });
  }
});

// @desc    Get billing statistics
// @route   GET /api/v1/financial/bills/stats/overview
// @access  Private
exports.getBillingOverview = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchCriteria = {};
  if (startDate && endDate) {
    matchCriteria.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const stats = await Billing.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: null,
        totalBills: { $sum: 1 },
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
        averageBillAmount: { $avg: '$total' },
        overdueBills: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $lt: ['$dueDate', new Date()] },
                  { $ne: ['$paymentStatus', 'paid'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalBills: 0,
    totalRevenue: 0,
    totalPaid: 0,
    averageBillAmount: 0,
    overdueBills: 0
  };

  // Convert from storage format to display format
  const formattedStats = {
    totalBills: result.totalBills,
    totalRevenue: currencyUtils.fromStorageFormat(result.totalRevenue, 'USD'),
    totalPaid: currencyUtils.fromStorageFormat(result.totalPaid, 'USD'),
    averageBillAmount: currencyUtils.fromStorageFormat(result.averageBillAmount, 'USD'),
    overdueBills: result.overdueBills,
    outstandingBalance: currencyUtils.fromStorageFormat(result.totalRevenue - result.totalPaid, 'USD')
  };

  res.status(200).json({
    success: true,
    data: formattedStats
  });
});