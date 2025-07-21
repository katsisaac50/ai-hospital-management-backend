const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true,
  },
  type: {
    type: String,
    enum: ['dispense', 'restock', 'adjustment'],
    required: true,
  },
  quantityChanged: {
    type: Number,
    required: true,
  },
  newQuantity: {
    type: Number,
    required: true,
  },
  relatedPrescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
  },
  remarks: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // optional if you track users
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);
