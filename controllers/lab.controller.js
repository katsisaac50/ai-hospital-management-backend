const LabTest = require('../models/labTest.model');
const Patient = require('../models/patient.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all lab tests
// @route   GET /api/v1/lab/tests
// @access  Private
exports.getLabTests = asyncHandler(async (req, res, next) => {
  console.log('dengling')
  // Advanced filtering, sorting, pagination
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  query = LabTest.find(JSON.parse(queryStr))
    .populate('patientId', 'medicalRecordNumber name dob gender firstName lastName')
    .populate('orderedById', 'name role');

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
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await LabTest.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const tests = await query;

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
    count: tests.length,
    pagination: {
      ...pagination,
      page,
      limit,
      total
    },
    data: tests
  });
});

// @desc    Get single lab test
// @route   GET /api/v1/lab/tests/:id
// @access  Private
exports.getLabTest = asyncHandler(async (req, res, next) => {
  const test = await LabTest.findById(req.params.id)
    .populate('patientId', 'name dob gender contact')
    .populate('orderedById', 'name role email');

  if (!test) {
    return next(new ErrorResponse(`Test not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to access this test
  const orderedByIdStr = test.orderedById._id ? test.orderedById._id.toString() : test.orderedById.toString();
if (orderedByIdStr !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to access this test`, 401));
}

  // Return the test data
  res.status(200).json({
    success: true,
    data: test
  });
});

// @desc    Create new lab test
// @route   POST /api/v1/lab/tests
// @access  Private
exports.createLabTest = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.orderedById = req.user.id;
  req.body.orderedBy = req.user.name;

  // Validate required fields
  if (!req.body.patientId || !req.body.testType || !req.body.sampleType) {
    return next(new ErrorResponse('Please provide patient, test type and sample type', 400));
  }

  // Get patient details
  const patient = await Patient.findById(req.body.patientId);
  if (!patient) {
    return next(new ErrorResponse(`Patient not found with id of ${req.body.patientId}`, 404));
  }

  req.body.patientName = patient.name;

  const test = await LabTest.create(req.body);

  // Populate the created test
  const populatedTest = await LabTest.findById(test._id)
    .populate('patientId', 'name dob gender')
    .populate('orderedById', 'name role');

  res.status(201).json({
    success: true,
    data: populatedTest
  });
});

// @desc    Update lab test
// @route   PUT /api/v1/lab/tests/:id
// @access  Private
exports.updateLabTest = asyncHandler(async (req, res, next) => {
  console.log('Updating lab test', req.params);

  let test = await LabTest.findById(req.params.id);

  if (!test) {
    return next(new ErrorResponse(`Test not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is the one who ordered the test or is admin
  if (test.orderedById.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update this test`, 401)
    );
  }
console.log('User authorized to update test', req.body, 'test', test)
  // If updating patient, validate patient exists
  if (req.body.patientId && req.body.patientId !== test.patientId.toString()) {
    const patient = await Patient.findById(req.body.patientId);
    console.log('Patient found:', patient);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      
    if (!patient) {
      return next(new ErrorResponse(`Patient not found with id of ${req.body.patientId}`, 404));
    }
    
    req.body.patientId = patient._id;
    req.body.patientName = patient.name; // Update patient name if changed

  }

  // 🔹 Sanitize req.body (remove null/undefined and clean arrays)
  const updateData = {};
  for (const key in req.body) {
    let value = req.body[key];

    if (value === null || value === undefined) continue;

    // If it's an array, remove null/undefined entries
    if (Array.isArray(value)) {
      value = value.filter(item => item !== null && item !== undefined);
    }

    updateData[key] = value;
  }

  console.log('Update data prepared:', updateData);

  // Perform update
  test = await LabTest.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  })
    .populate('patientId', 'name dob gender')
    .populate('orderedById', 'name role');

  if (!test) {
    return next(new ErrorResponse(`Failed to update test with id of ${req.params.id}`, 500));
  }

  res.status(200).json({
    success: true,
    data: test
  });
});


// @desc    Delete lab test
// @route   DELETE /api/v1/lab/tests/:id
// @access  Private
exports.deleteLabTest = asyncHandler(async (req, res, next) => {
  const test = await LabTest.findById(req.params.id);

  if (!test) {
    return next(new ErrorResponse(`Test not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is the one who ordered the test or is admin
  if (test.orderedById.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to delete this test`, 401)
    );
  }

  await test.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get lab tests by category (paginated, optional)
// @route   GET /api/v1/lab/tests/category/:category?page=1&limit=10&search=keyword
// @access  Private
exports.getTestsByCategory = asyncHandler(async (req, res, next) => {
  let { category } = req.params;
  const { search } = req.query;
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);

  // Normalize category to lowercase for case-insensitive matching
  category = category.toLowerCase();

  // Base query with case-insensitive category matching (using $regex with ^ and $ to match exact word)
  // Using regex with 'i' for case-insensitive match on indexed 'category'
  let query = {
    category: { $regex: `^${category}$`, $options: 'i' },
  };

  // Role-based filter: non-admins see only their own tests
  if (req.user.role !== 'admin') {
    query.orderedById = req.user.id;
  }

  // Search filter (across testType, description, patientName)
  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { testType: searchRegex },
      { description: searchRegex },
      { patientName: searchRegex },
    ];
  }

  // Build the query with population
  let testsQuery = LabTest.find(query)
    .populate('patientId', 'name dob gender contact')
    .populate('orderedById', 'name role email')
    .sort({ createdAt: -1 });

  // Apply pagination if page and limit are valid numbers
  if (!isNaN(page) && !isNaN(limit)) {
    const skip = (page - 1) * limit;
    testsQuery = testsQuery.skip(skip).limit(limit);
  }

  // Execute query
  const tests = await testsQuery.exec();

  // Count total documents matching query (for pagination)
  const total = await LabTest.countDocuments(query);

  if (total === 0) {
    return next(new ErrorResponse(`No tests found for category '${category}'`, 404));
  }

  res.status(200).json({
    success: true,
    count: tests.length,
    total,
    page: !isNaN(page) ? page : null,
    totalPages: !isNaN(page) && !isNaN(limit) ? Math.ceil(total / limit) : null,
    data: tests,
  });
});

// Note: The following function is commented out as it was not part of the recent edits.
// Uncomment and modify as needed for your application.

// @desc    Submit lab test results
// @route   POST /api/v1/lab/results/:testId
// @access  Private
// exports.submitResults = asyncHandler(async (req, res, next) => {
//   const { testId } = req.params;

//   // Validate results
//   if (!req.body.results || typeof req.body.results !== 'object') {
//     return next(new ErrorResponse('Please provide valid results data', 400));
//   } 
//   // Find the lab test
//   const test = await LabTest.findById(testId);
//   if (!test) {
//     return next(new ErrorResponse(`Test not found with id of ${testId}`, 404));
//   } 
//   // Check if user is authorized to submit results
//   if (test.orderedById.toString() !== req.user.id && req.user.role !== 'admin') {
//     return next(new ErrorResponse(`User ${req.user.id} is not authorized to submit results for this test`, 401));
//   }
//   // Update the test with results
//   test.results = req.body.results;
//   test.status = 'completed';
//   test.completedDate = new Date();
//   test.technicianNotes = req.body.technicianNotes || '';
//   await test.save();

//   // Populate the updated test
//   const populatedTest = await LabTest.findById(test._id)
//     .populate('patientId', 'name dob')  
//     .populate('orderedById', 'name role');

//   res.status(200).json({
//     success: true,
//     data: populatedTest
//   });
// }); 


