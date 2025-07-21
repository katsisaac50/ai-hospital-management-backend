const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  items: [
    {
      description: String,
      quantity: Number,
      unitPrice: Number,
      amount: Number,
    },
  ],
  subtotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending',
  },
  payments: [
    {
      amount: Number,
      method: {
        type: String,
        enum: ['cash', 'card', 'insurance', 'bank-transfer'],
      },
      date: Date,
      transactionId: String,
    },
  ],
  insuranceClaim: {
    isClaimed: Boolean,
    claimAmount: Number,
    claimStatus: String,
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Billing', billingSchema);