const mongoose = require('mongoose');

const StockLogSchema = new mongoose.Schema({
  medicationName: String,
  unit: String,
  quantity: Number,
  type: { type: String, enum: ['low-stock', 'restock'], default: 'low-stock' },
}, { timestamps: true });

module.exports = mongoose.model('StockLog', StockLogSchema);
