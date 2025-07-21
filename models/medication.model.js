const mongoose = require('mongoose')

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add medication name'],
  },
  genericName: String,

  strength: {
    type: String,
    required: [true, 'Please specify strength of the medication'],
  },
  unit: {
    type: String,
    enum: ['mg', 'ml', 'IU', 'g', 'mcg'],
  },

  form: {
    type: String,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops'],
  },

  // form: String, // You can keep this for display purposes if needed (optional)
  manufacturer: String,

  batchNumber: {
    type: String,
    required: true,
  },

  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
  },

  quantity: {
    type: Number,
    required: true,
  },

  price: {
    type: Number,
    required: true,
  },

  minStock: Number,
  maxStock: Number,

  location: String,

  category: {
    type: String,
    enum: [
      'antibiotic',
      'analgesic',
      'antipyretic',
      'antidiabetic',
      'antihypertensive',
      'PPI',
      'ACE Inhibitor',
      'antacid',
      'antihistamine',
      'other'
    ],
  },

  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'],
    default: 'In Stock',
  },

  isControlled: {
    type: Boolean,
    default: false,
  },

  reorderLevel: {
    type: Number,
    default: 10,
  },

  supplier: {
    name: String,
    contact: String,
  },

  lastUpdated: {
    type: Date,
    default: Date.now,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Prevent saving expired medications
medicationSchema.pre('save', function (next) {
  if (this.expiryDate && this.expiryDate < Date.now()) {
    return next(new Error('Cannot add medication with past expiry date.'))
  }

   // Auto-calculate stock status
  const qty = this.quantity || 0
  const min = this.minStock || 0

  if (qty <= 0) {
    this.status = 'Out of Stock'
  } else if (qty <= min * 0.5) {
    this.status = 'Critical'
  } else if (qty <= min) {
    this.status = 'Low Stock'
  } else {
    this.status = 'In Stock'
  }
  
  this.lastUpdated = Date.now()
  next()
})

//  🔁 Pre-findOneAndUpdate hook to auto-calculate status
medicationSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();

  const quantity = update.quantity;
  const minStock = update.minStock ?? 0;

  if (quantity !== undefined) {
    if (quantity <= 0) {
      update.status = 'Out of Stock';
    } else if (quantity <= 0.5 * minStock) {
      update.status = 'Critical';
    } else if (quantity <= minStock) {
      update.status = 'Low Stock';
    } else {
      update.status = 'In Stock';
    }
  }

  update.lastUpdated = Date.now();
  this.setUpdate(update);
  next();
});

module.exports = mongoose.model('Medication', medicationSchema)
