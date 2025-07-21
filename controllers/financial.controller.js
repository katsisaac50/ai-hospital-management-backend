const Billing = require('../models/billing.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all billing records
// @route   GET /api/v1/financial/bills
// @access  Private
exports.getBills = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
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

// @desc    Create new bill
// @route   POST /api/v1/financial/bills
// @access  Private
exports.createBill = asyncHandler(async (req, res, next) => {
  // Calculate totals
  const items = req.body.items || [];
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax = req.body.tax || 0;
  const discount = req.body.discount || 0;
  const total = subtotal + tax - discount;

  const billData = {
    ...req.body,
    subtotal,
    total,
  };

  const bill = await Billing.create(billData);

  res.status(201).json({
    success: true,
    data: bill,
  });
});

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