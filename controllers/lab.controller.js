const LabTest = require('../models/labTest.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all lab tests
// @route   GET /api/v1/lab/tests
// @access  Private
exports.getLabTests = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single lab test
// @route   GET /api/v1/lab/tests/:id
// @access  Private
exports.getLabTest = asyncHandler(async (req, res, next) => {
  const labTest = await LabTest.findById(req.params.id);

  if (!labTest) {
    return next(
      new ErrorResponse(`Lab test not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: labTest,
  });
});

// @desc    Create new lab test
// @route   POST /api/v1/lab/tests
// @access  Private
exports.createLabTest = asyncHandler(async (req, res, next) => {
  const labTest = await LabTest.create(req.body);

  res.status(201).json({
    success: true,
    data: labTest,
  });
});

// @desc    Update lab test
// @route   PUT /api/v1/lab/tests/:id
// @access  Private
exports.updateLabTest = asyncHandler(async (req, res, next) => {
  const labTest = await LabTest.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!labTest) {
    return next(
      new ErrorResponse(`Lab test not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: labTest,
  });
});

// @desc    Delete lab test
// @route   DELETE /api/v1/lab/tests/:id
// @access  Private
exports.deleteLabTest = asyncHandler(async (req, res, next) => {
  const labTest = await LabTest.findByIdAndDelete(req.params.id);

  if (!labTest) {
    return next(
      new ErrorResponse(`Lab test not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get tests by category
// @route   GET /api/v1/lab/tests/category/:category
// @access  Private
exports.getTestsByCategory = asyncHandler(async (req, res, next) => {
  const tests = await LabTest.find({ category: req.params.category });

  res.status(200).json({
    success: true,
    count: tests.length,
    data: tests,
  });
});