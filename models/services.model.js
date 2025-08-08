const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    unique: true,
    uniqueCaseInsensitive: true,
    minlength: [3, 'Service name must be at least 3 characters'],
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Service code is required'],
    trim: true,
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9]{3,10}$/, 'Please use only uppercase letters and numbers (3-10 characters)']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    max: [100000, 'Price cannot exceed 100,000']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['consultation', 'diagnostic', 'treatment', 'procedure', 'other']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add plugins
serviceSchema.plugin(uniqueValidator, { 
  message: 'Error, {PATH} "{VALUE}" already exists' 
});

// Text index for search
serviceSchema.index({ name: 'text', description: 'text', code: 'text' });

// Pre-save hook to normalize name
serviceSchema.pre('save', function(next) {
  this.name = this.name.trim().replace(/\s+/g, ' ');
  next();
});

// Static method for checking uniqueness
serviceSchema.statics.isUnique = async function(field, value, excludeId) {
  const query = { [field]: new RegExp(`^${value}$`, 'i') };
  if (excludeId) query._id = { $ne: excludeId };
  const service = await this.findOne(query);
  return !service;
};

module.exports = mongoose.model('Service', serviceSchema);