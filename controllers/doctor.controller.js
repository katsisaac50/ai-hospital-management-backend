const Doctor = require('../models/doctor.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all doctors
// @route   GET /api/v1/doctors
// @access  Private
exports.getDoctors = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single doctor
// @route   GET /api/v1/doctors/:id
// @access  Private
exports.getDoctor = asyncHandler(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id);

  if (!doctor) {
    return next(
      new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: doctor,
  });
});

// @desc    Create new doctor
// @route   POST /api/v1/doctors
// @access  Private
exports.createDoctor = asyncHandler(async (req, res, next) => {
  const doctor = await Doctor.create(req.body);

  res.status(201).json({
    success: true,
    data: doctor,
  });
});

// @desc    Update doctor
// @route   PUT /api/v1/doctors/:id
// @access  Private
exports.updateDoctor = asyncHandler(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!doctor) {
    return next(
      new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: doctor,
  });
});

// @desc    Delete doctor
// @route   DELETE /api/v1/doctors/:id
// @access  Private
exports.deleteDoctor = asyncHandler(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);

  if (!doctor) {
    return next(
      new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get doctor schedule
// @route   GET /api/v1/doctors/:id/schedule
// @access  Private
exports.getDoctorSchedule = asyncHandler(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id).select('schedule');

  if (!doctor) {
    return next(
      new ErrorResponse(`Doctor not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: doctor.schedule,
  });
});