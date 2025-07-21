const Appointment = require('../models/appointment.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all appointments
// @route   GET /api/v1/appointments
// @access  Private
exports.getAppointments = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single appointment
// @route   GET /api/v1/appointments/:id
// @access  Private
exports.getAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'firstName lastName phone')
    .populate('doctor', 'firstName lastName specialization');

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: appointment,
  });
});

// @desc    Create new appointment
// @route   POST /api/v1/appointments
// @access  Private
exports.createAppointment = asyncHandler(async (req, res, next) => {
  // Check for existing appointment at same time
  const existingAppointment = await Appointment.findOne({
    doctor: req.body.doctor,
    date: req.body.date,
    time: req.body.time,
  });

  if (existingAppointment) {
    return next(
      new ErrorResponse('Doctor already has an appointment at this time', 400)
    );
  }

  const appointment = await Appointment.create(req.body);

  res.status(201).json({
    success: true,
    data: appointment,
  });
});

// @desc    Update appointment
// @route   PUT /api/v1/appointments/:id
// @access  Private
exports.updateAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: appointment,
  });
});

// @desc    Delete appointment
// @route   DELETE /api/v1/appointments/:id
// @access  Private
exports.deleteAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get appointments by date range
// @route   GET /api/v1/appointments/range/:start/:end
// @access  Private
exports.getAppointmentsByDateRange = asyncHandler(async (req, res, next) => {
  const { start, end } = req.params;

  const appointments = await Appointment.find({
    date: {
      $gte: new Date(start),
      $lte: new Date(end),
    },
  })
    .populate('patient', 'firstName lastName')
    .populate('doctor', 'firstName lastName');

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});