// const asyncHandler = require("../utils/async");
// const ErrorResponse = require("../utils/errorResponse");

// const allowedStores = [
//   "patients",
//   "doctors",
//   "appointments",
//   "assessments",
//   "medications",
//   "lab_tests",
//   "invoices",
// ];

// // Dynamically require models based on store name
// const getModel = (storeName) => {
//   if (!allowedStores.includes(storeName)) {
//     throw new ErrorResponse(`Store '${storeName}' is not allowed`, 400);
//   }
//   return require(`../models/${storeName}.model`);
// };

// // @desc    Get all records
// // @route   GET /api/v1/pharmacy/:storeName
// // @access  Private
// exports.getAll = asyncHandler(async (req, res, next) => {
//   const Model = getModel(req.params.storeName);
//   const data = await Model.find().sort({ updatedAt: -1 });
//   res.status(200).json({ success: true, count: data.length, data });
// });

// // @desc    Get single record
// // @route   GET /api/v1/pharmacy/:storeName/:id
// // @access  Private
// exports.getOne = asyncHandler(async (req, res, next) => {
//   const Model = getModel(req.params.storeName);
//   const item = await Model.findById(req.params.id);
//   if (!item) {
//     return next(new ErrorResponse(`${req.params.storeName} not found`, 404));
//   }
//   res.status(200).json({ success: true, data: item });
// });

// // @desc    Create record
// // @route   POST /api/v1/pharmacy/:storeName
// // @access  Private
// exports.createOne = asyncHandler(async (req, res, next) => {
//   const Model = getModel(req.params.storeName);
//   const item = await Model.create(req.body);
//   res.status(201).json({ success: true, data: item });
// });

// // @desc    Update record
// // @route   PUT /api/v1/pharmacy/:storeName/:id
// // @access  Private
// exports.updateOne = asyncHandler(async (req, res, next) => {
//   const Model = getModel(req.params.storeName);
//   const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//   });
//   if (!updated) {
//     return next(new ErrorResponse(`Item not found`, 404));
//   }
//   res.status(200).json({ success: true, data: updated });
// });

// // @desc    Delete record
// // @route   DELETE /api/v1/pharmacy/:storeName/:id
// // @access  Private
// exports.deleteOne = asyncHandler(async (req, res, next) => {
//   const Model = getModel(req.params.storeName);
//   const deleted = await Model.findByIdAndDelete(req.params.id);
//   if (!deleted) {
//     return next(new ErrorResponse(`Item not found`, 404));
//   }
//   res.status(200).json({ success: true, data: {} });
// });

// // @desc    Get low stock medications
// // @route   GET /api/v1/pharmacy/medications/low-stock
// // @access  Private
// exports.getLowStockMedications = asyncHandler(async (req, res, next) => {
//   const medications = await Medication.find({
//     quantity: { $lte: 10 }, // Assuming reorderLevel is 10
//   });

//   res.status(200).json({
//     success: true,
//     count: medications.length,
//     data: medications,
//   });
// });




const Medication = require('../models/medication.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');


// @desc    Get all medications
// @route   GET /api/v1/pharmacy/medications
// @access  Private
exports.getMedications = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single medication
// @route   GET /api/v1/pharmacy/medications/:id
// @access  Private
exports.getMedication = asyncHandler(async (req, res, next) => {
  const medication = await Medication.findById(req.params.id);

  if (!medication) {
    return next(
      new ErrorResponse(`Medication not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: medication,
  });
});

// @desc    Create new medication
// @route   POST /api/v1/pharmacy/medications
// @access  Private
exports.createMedication = asyncHandler(async (req, res, next) => {
  
  try {
      const medication = await Medication.create(req.body);
      return  res.status(201).json({
    success: true,
    data: medication,
  });
      
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

 
});

// @desc    Update medication
// @route   PUT /api/v1/pharmacy/medications/:id
// @access  Private
exports.updateMedication = asyncHandler(async (req, res, next) => {
  const medication = await Medication.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!medication) {
    return next(
      new ErrorResponse(`Medication not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: medication,
  });
});

// @desc    Delete medication
// @route   DELETE /api/v1/pharmacy/medications/:id
// @access  Private
exports.deleteMedication = asyncHandler(async (req, res, next) => {
  const medication = await Medication.findByIdAndDelete(req.params.id);

  if (!medication) {
    return next(
      new ErrorResponse(`Medication not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get low stock medications
// @route   GET /api/v1/pharmacy/medications/low-stock
// @access  Private
exports.getLowStockMedications = asyncHandler(async (req, res, next) => {
  const medications = await Medication.find({
    quantity: { $lte: 10 }, // Assuming reorderLevel is 10
  });

  res.status(200).json({
    success: true,
    count: medications.length,
    data: medications,
  });
});
