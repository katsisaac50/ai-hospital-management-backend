const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const Claim = require('../models/claim.model');

// @desc    Get all claims
// @route   GET /api/v1/claims
// @access  Private
exports.getClaims = asyncHandler(async (req, res, next) => {
  // Advanced filtering, sorting, pagination
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit', 'search', 'status', 'provider'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource with population
  query = Claim.find(JSON.parse(queryStr))
    .populate({
      path: 'patient',
      select: 'name email phone insuranceProvider insuranceId'
    })
    .populate({
      path: 'billing',
      select: 'invoiceNumber total currency status paymentStatus insurance insuranceClaim',
      populate: {
        path: 'patient',
        select: 'name'
      }
    })
    .populate({
      path: 'payment',
      select: 'amount method status transactionId date'
    });

  // Search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query = query.find({
      $or: [
        { 'patient.name': searchRegex },
        { id: searchRegex },
        { 'billing.insurance': searchRegex },
        { 'billing.invoiceNumber': searchRegex }
      ]
    });
  }

  // Status filter
  if (req.query.status && req.query.status !== 'All') {
    query = query.byStatus(req.query.status);
  }

  // Provider filter
  if (req.query.provider && req.query.provider !== 'All') {
    query = query.byProvider(req.query.provider);
  }

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
    query = query.sort('-submittedDate');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  // Get total count (without pagination)
  const countQuery = query.model.find().merge(query);
  const total = await countQuery.countDocuments();

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const claims = await query;

  // Format response to match frontend expectations using virtuals
  const formattedClaims = claims.map(claim => ({
    id: claim.id,
    patientName: claim.patientName,
    provider: claim.provider,
    amount: claim.amount,
    status: claim.status,
    submittedDate: claim.formattedSubmittedDate,
    processedDate: claim.formattedProcessedDate,
    patient: claim.patient,
    billing: claim.billing,
    payment: claim.payment,
    notes: claim.notes
  }));

  // Filter out null results from population filtering
  const filteredClaims = formattedClaims.filter(claim => 
    claim.billing && claim.patientName
  );

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

  res.status(200).json({
    success: true,
    count: filteredClaims.length,
    pagination,
    data: filteredClaims
  });
});

// @desc    Get single claim
// @route   GET /api/v1/claims/:id
// @access  Private
exports.getClaim = asyncHandler(async (req, res, next) => {
  const claim = await Claim.findOne({ id: req.params.id })
    .populate({
      path: 'patient',
      select: 'name email phone insuranceProvider insuranceId'
    })
    .populate({
      path: 'billing',
      select: 'invoiceNumber total currency date dueDate status paymentStatus insurance insuranceClaim items',
      populate: {
        path: 'patient',
        select: 'name'
      }
    })
    .populate({
      path: 'payment',
      select: 'amount method status transactionId date notes'
    });

  if (!claim) {
    return next(
      new ErrorResponse(`Claim not found with id of ${req.params.id}`, 404)
    );
  }

  // Use virtuals to format response
  const responseData = {
    id: claim.id,
    patientName: claim.patientName,
    provider: claim.provider,
    amount: claim.amount,
    status: claim.status,
    submittedDate: claim.formattedSubmittedDate,
    processedDate: claim.formattedProcessedDate,
    patient: claim.patient,
    billing: claim.billing,
    payment: claim.payment,
    notes: claim.notes
  };

  res.status(200).json({
    success: true,
    data: responseData
  });
});

// @desc    Create new claim from billing
// @route   POST /api/v1/claims/from-billing/:billingId
// @access  Private
exports.createClaimFromBilling = asyncHandler(async (req, res, next) => {
  const Billing = require('../models/billing.model');
  const Patient = require('../models/patient.model');
  
  const billing = await Billing.findById(req.params.billingId)
    .populate('patient', 'name insuranceProvider insuranceId');
  
  if (!billing) {
    return next(
      new ErrorResponse(`Billing not found with id of ${req.params.billingId}`, 404)
    );
  }
  
  if (billing.insuranceClaim.isClaimed) {
    return next(
      new ErrorResponse('Claim already exists for this billing', 400)
    );
  }
  
  // Create claim
  const claim = await Claim.create({
    patient: billing.patient._id,
    billing: billing._id,
    submittedDate: new Date(),
    createdBy: req.user.id,
    notes: req.body.notes || `Insurance claim for invoice ${billing.invoiceNumber}`
  });
  
  // Update billing with claim reference and insurance details
  await Billing.findByIdAndUpdate(
    billing._id,
    { 
      $set: { 
        'insuranceClaim.isClaimed': true,
        'insuranceClaim.claimStatus': 'submitted',
        'insuranceClaim.claimReference': claim.id,
        'insuranceClaim.claimAmount': billing.total,
        'insurance': billing.patient.insuranceProvider || 'Other'
      } 
    }
  );
  
  res.status(201).json({
    success: true,
    data: {
      id: claim.id,
      patientName: billing.patient.name,
      provider: billing.patient.insuranceProvider || 'Other',
      amount: billing.total,
      status: 'Under Review', // Maps to 'submitted' in billing
      submittedDate: claim.formattedSubmittedDate,
      billing: billing._id,
      notes: claim.notes
    }
  });
});

// @desc    Update claim status (which updates billing insurance claim status)
// @route   PUT /api/v1/claims/:id/status
// @access  Private
exports.updateClaimStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['Approved', 'Under Review', 'Denied', 'Pending'];
  
  if (!validStatuses.includes(status)) {
    return next(
      new ErrorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
    );
  }
  
  const claim = await Claim.findOne({ id: req.params.id }).populate('billing');
  
  if (!claim) {
    return next(
      new ErrorResponse(`Claim not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Map claim status to billing insurance claim status
  const statusMap = {
    'Pending': 'not-submitted',
    'Under Review': 'processing',
    'Approved': 'approved',
    'Denied': 'rejected'
  };
  
  const billingClaimStatus = statusMap[status];
  
  // Update billing insurance claim status
  const Billing = require('../models/billing.model');
  await Billing.findByIdAndUpdate(
    claim.billing._id,
    { 
      $set: { 
        'insuranceClaim.claimStatus': billingClaimStatus
      } 
    }
  );
  
  // If status is Approved or Denied, set processed date
  if (['Approved', 'Denied'].includes(status) && !claim.processedDate) {
    claim.processedDate = new Date();
    await claim.save();
  }
  
  // Get updated claim with populated data
  const updatedClaim = await Claim.findOne({ id: req.params.id })
    .populate({
      path: 'patient',
      select: 'name email phone insuranceProvider insuranceId'
    })
    .populate({
      path: 'billing',
      select: 'invoiceNumber total currency status paymentStatus insurance insuranceClaim'
    });
  
  res.status(200).json({
    success: true,
    data: {
      id: updatedClaim.id,
      patientName: updatedClaim.patientName,
      provider: updatedClaim.provider,
      amount: updatedClaim.amount,
      status: updatedClaim.status,
      submittedDate: updatedClaim.formattedSubmittedDate,
      processedDate: updatedClaim.formattedProcessedDate,
      billing: updatedClaim.billing
    }
  });
});

// @desc    Get claims statistics
// @route   GET /api/v1/claims/stats
// @access  Private
exports.getClaimStats = asyncHandler(async (req, res, next) => {
  const Billing = require('../models/billing.model');
  
  // Get stats from billing collection since that's the source of truth
  const stats = await Billing.aggregate([
    { $match: { 'insuranceClaim.isClaimed': true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        approved: { 
          $sum: { 
            $cond: [{ $in: ['$insuranceClaim.claimStatus', ['approved', 'paid']] }, 1, 0] 
          } 
        },
        underReview: { 
          $sum: { 
            $cond: [{ $in: ['$insuranceClaim.claimStatus', ['submitted', 'processing']] }, 1, 0] 
          } 
        },
        denied: { 
          $sum: { 
            $cond: [{ $eq: ['$insuranceClaim.claimStatus', 'rejected'] }, 1, 0] 
          } 
        },
        pending: { 
          $sum: { 
            $cond: [{ $eq: ['$insuranceClaim.claimStatus', 'not-submitted'] }, 1, 0] 
          } 
        },
        totalAmount: { $sum: '$insuranceClaim.claimAmount' },
        approvedAmount: { 
          $sum: { 
            $cond: [{ $in: ['$insuranceClaim.claimStatus', ['approved', 'paid']] }, '$insuranceClaim.claimAmount', 0] 
          } 
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        total: 0,
        approved: 0,
        underReview: 0,
        denied: 0,
        pending: 0,
        totalAmount: 0,
        approvedAmount: 0
      }
    });
  }

  res.status(200).json({
    success: true,
    data: stats[0]
  });
});

// Keep other controller methods (delete, seed, etc.) but update them to work with the new model structure




// @desc    Delete claim
// @route   DELETE /api/v1/claims/:id
// @access  Private
exports.deleteClaim = asyncHandler(async (req, res, next) => {
  const claim = await Claim.findOne({ id: req.params.id });

  if (!claim) {
    return next(
      new ErrorResponse(`Claim not found with id of ${req.params.id}`, 404)
    );
  }

  await Claim.deleteOne({ id: req.params.id });

  res.status(200).json({
    success: true,
    data: {}
  });
});



// @desc    Seed claim data
// @route   POST /api/v1/claims/seed
// @access  Private/Admin
exports.seedClaims = asyncHandler(async (req, res, next) => {
  // Delete existing claims
  await Claim.deleteMany();

  // Create sample patients if they don't exist
  const Patient = require('../models/patient.model');
  let patients = await Patient.find();
  
  if (patients.length === 0) {
    patients = await Patient.create([
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '555-0101',
        insuranceProvider: 'BlueCross',
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
        insuranceProvider: 'UnitedHealth',
        insuranceId: 'UH345678'
      },
      {
        name: 'James Wilson',
        email: 'james.wilson@example.com',
        phone: '555-0104',
        insuranceProvider: 'BlueCross',
        insuranceId: 'BC901234'
      },
      {
        name: 'Lisa Taylor',
        email: 'lisa.taylor@example.com',
        phone: '555-0105',
        insuranceProvider: 'Aetna',
        insuranceId: 'AE567890'
      },
      {
        name: 'Robert Brown',
        email: 'robert.brown@example.com',
        phone: '555-0106',
        insuranceProvider: 'UnitedHealth',
        insuranceId: 'UH123456'
      }
    ]);
  }

  // Create sample claims
  const claims = await Claim.create([
    {
      patient: patients[0]._id,
      patientName: patients[0].name,
      provider: 'BlueCross',
      amount: 450.75,
      status: 'Approved',
      submittedDate: new Date('2024-01-10'),
      processedDate: new Date('2024-01-15')
    },
    {
      patient: patients[1]._id,
      patientName: patients[1].name,
      provider: 'Aetna',
      amount: 1250.0,
      status: 'Under Review',
      submittedDate: new Date('2024-01-12')
    },
    {
      patient: patients[2]._id,
      patientName: patients[2].name,
      provider: 'UnitedHealth',
      amount: 890.25,
      status: 'Denied',
      submittedDate: new Date('2024-01-08'),
      processedDate: new Date('2024-01-14')
    },
    {
      patient: patients[3]._id,
      patientName: patients[3].name,
      provider: 'BlueCross',
      amount: 2150.0,
      status: 'Under Review',
      submittedDate: new Date('2024-01-15')
    },
    {
      patient: patients[4]._id,
      patientName: patients[4].name,
      provider: 'Aetna',
      amount: 750.5,
      status: 'Approved',
      submittedDate: new Date('2024-01-05'),
      processedDate: new Date('2024-01-10')
    },
    {
      patient: patients[5]._id,
      patientName: patients[5].name,
      provider: 'UnitedHealth',
      amount: 3200.0,
      status: 'Approved',
      submittedDate: new Date('2024-01-03'),
      processedDate: new Date('2024-01-08')
    }
  ]);

  res.status(200).json({
    success: true,
    data: claims
  });
});