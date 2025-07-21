const mongoose = require('mongoose');

const surgeryHistorySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  surgeryType: String,
  startedAt: Date,
  endedAt: Date,
  notes: String,
});

const operatingRoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['general', 'orthopedic', 'cardiac', 'neuro', 'other'],
    default: 'general',
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'cleaning'],
    default: 'available',
  },
  currentPatient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    default: null,
  },
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  scheduledAt: Date,
  occupiedSince: Date,
  expectedRelease: Date,
  notes: String,

  // New: OR usage history
  history: [surgeryHistorySchema],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('OperatingRoom', operatingRoomSchema);
