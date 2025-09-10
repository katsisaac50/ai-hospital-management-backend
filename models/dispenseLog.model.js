const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const DispenseLogSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },

    prescription: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription',
      required: false, // optional, in case it’s walk-in meds
    },

    medications: [
      {
        medication: { type: Schema.Types.ObjectId, ref: 'Medication', required: true },
        dosage: String,
        quantity: Number,
        instructions: String,
      },
    ],
    dispensedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Assuming your pharmacy staff are users
      required: true,
    },
    method: {
      type: String,
      enum: ['dispensed', 'delivered', 'pickup'],
      default: 'dispensed',
    },
    dispensedAt: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = models.DispenseLog || model('DispenseLog', DispenseLogSchema);


// const logs = await DispenseLog.find()
//   .populate('patient')
//   .populate('dispensedBy')
//   .populate('medications.medication')
//   .populate('prescription');