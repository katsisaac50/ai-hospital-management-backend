const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctor: {
    type: mongoose.Schema.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  scheduleSlot: {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  date: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        // Scheduled appointments cannot be in the past
        if (this.status === 'scheduled') {
          return v >= new Date();
        }
        return true;
      },
      message: props => `Appointment date ${props.value} cannot be in the past for scheduled appointments.`,
    },
  },
  time: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
    default: 30, // minutes
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled',
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent double booking for doctors
appointmentSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);