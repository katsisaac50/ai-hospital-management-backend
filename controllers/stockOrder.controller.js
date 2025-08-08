const StockOrder = require('../models/stockOrder.model')
const ErrorResponse = require('../utils/errorResponse')
const asyncHandler = require('../utils/async')

// @desc    Get all stock orders
// @route   GET /api/v1/stock-orders
// @access  Private
exports.getStockOrders = asyncHandler(async (req, res, next) => {
  const orders = await StockOrder.find().sort({ createdAt: -1 })
  res.status(200).json({ success: true, count: orders.length, data: orders })
})

// @desc    Get single stock order
// @route   GET /api/v1/stock-orders/:id
// @access  Private
exports.getStockOrder = asyncHandler(async (req, res, next) => {
  const order = await StockOrder.findById(req.params.id)
  if (!order) {
    return next(new ErrorResponse(`Stock order not found with id ${req.params.id}`, 404))
  }

  res.status(200).json({ success: true, data: order })
})

// @desc    Create new stock order
// @route   POST /api/v1/stock-orders
// @access  Private
exports.createStockOrder = asyncHandler(async (req, res, next) => {
  const order = await StockOrder.create(req.body)
  res.status(201).json({ success: true, data: order })
})

// @desc    Update stock order
// @route   PUT /api/v1/stock-orders/:id
// @access  Private
exports.updateStockOrder = asyncHandler(async (req, res, next) => {
  const order = await StockOrder.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!order) {
    return next(new ErrorResponse(`Stock order not found with id ${req.params.id}`, 404))
  }

  res.status(200).json({ success: true, data: order })
})

// @desc    Delete stock order
// @route   DELETE /api/v1/stock-orders/:id
// @access  Private
exports.deleteStockOrder = asyncHandler(async (req, res, next) => {
  const order = await StockOrder.findByIdAndDelete(req.params.id)
  if (!order) {
    return next(new ErrorResponse(`Stock order not found with id ${req.params.id}`, 404))
  }

  res.status(200).json({ success: true, data: {} })
})
