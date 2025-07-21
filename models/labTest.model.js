const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add test name'],
  },
  category: {
    type: String,
    enum: ['hematology', 'biochemistry', 'microbiology', 'pathology', 'radiology'],
    required: true,
  },
  description: String,
  price: {
    type: Number,
    required: true,
  },
  turnaroundTime: {
    type: Number, // hours
    required: true,
  },
  sampleType: {
    type: String,
    required: true,
  },
  preparationInstructions: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('LabTest', labTestSchema);