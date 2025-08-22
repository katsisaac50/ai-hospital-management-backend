const LabEquipment = require('../models/equipment.model'); // Assuming you have a LabEquipment model
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');


// @desc    Get lab equipments
// @route   GET /api/v1/lab/equipment
// @access  Private
// exports.getEquipment = asyncHandler(async (req, res, next) => {
//   res.status(200).json(res.advancedResults);
// });
exports.getEquipment = asyncHandler(async (req, res, next) => {
  // Assuming you have a LabEquipment model similar to LabTest
  const equipment = await LabEquipment.find()
    .populate('technicianInCharge', 'name role email'); // Adjust based on your model
  if (!equipment || equipment.length === 0) {
    return next(new ErrorResponse('No lab equipment found', 404));
  }

  res.status(200).json({
    success: true,
    count: equipment.length,
    data: equipment
  });
});

// @desc    Create new lab equipment
// @route   POST /api/v1/lab/equipment
// @access  Private
exports.createEquipment = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;
  // Validate required fields
  if (!req.body.name || !req.body.type || !req.body.status) {
    return next(new ErrorResponse('Please provide name, type and status for the equipment', 400));
  }
  // Create new equipment
  const equipment = await LabEquipment.create(req.body);
  // Populate the created equipment
  const populatedEquipment = await LabEquipment.findById(equipment._id)
    .populate('createdBy', 'name role email');
  res.status(201).json({
    success: true,
    data: populatedEquipment
  });
});

// @desc    Update equipment status
// @route   PUT /api/v1/lab/equipment/:id
// @access  Private (Lab Technician or Admin)
exports.updateEquipment = asyncHandler(async (req, res, next) => {
  // Check if user is authorized
  if (req.user.role !== 'lab_technician' && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update equipment`, 403)
    );
  }

  const equipment = await Equipment.findById(req.params.id);

  if (!equipment) {
    return next(new ErrorResponse(`Equipment not found with id of ${req.params.id}`, 404));
  }

  // Validate status
  const validStatuses = ['online', 'in_use', 'maintenance', 'offline'];
  if (req.body.status && !validStatuses.includes(req.body.status)) {
    return next(new ErrorResponse(`Invalid status value`, 400));
  }

  // If setting to maintenance, ensure we have maintenance dates
  if (req.body.status === 'maintenance') {
    if (!req.body.lastMaintenance) {
      req.body.lastMaintenance = new Date();
    }
    if (!req.body.nextMaintenance) {
      // Default to 3 months from now
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 3);
      req.body.nextMaintenance = nextDate;
    }
  }

  // Update equipment
  const updatedEquipment = await Equipment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: updatedEquipment
  });
});