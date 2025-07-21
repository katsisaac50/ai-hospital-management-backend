const mongoose = require('mongoose');

const stockOrderSchema = new mongoose.Schema({
  medicationName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  supplier: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'received'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.models.StockOrder || mongoose.model('StockOrder', stockOrderSchema);
