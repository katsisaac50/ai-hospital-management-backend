const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  model: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['online', 'in_use', 'maintenance', 'offline'], 
    default: 'online' 
  },
  lastMaintenance: { type: Date },
  nextMaintenance: { type: Date },
  location: { type: String },
  technicianInCharge: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  testsToday: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);