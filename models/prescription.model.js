const { Schema, model, models, Types } = require('mongoose');

const prescriptionSchema = new Schema({
  patient: {
    type: Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctor: {
    type: Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  medications: [
    {
      medication: {
        type: Types.ObjectId,
        ref: 'Medication',
        required: true,
      },
      dosage: String,
      frequency: String,
      duration: String, // e.g., "5 days"
      quantity: Number,
      cost: Number,
    }
  ],
  totalCost: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Pending', 'Ready', 'Dispensed', 'Verification Required'],
    default: 'Pending',
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
  },
  insurance: {
  provider: String,
  policyNumber: String,
  copay: {
    type: Number,
    default: 0,
  },
  coverageDetails: String, // optional
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

prescriptionSchema.pre('findOneAndUpdate', async function (next) {
   const update = this.getUpdate();

  if (!['Dispensed', 'Confirmed'].includes(update.status)) return next();

  const prescription = await this.model.findOne(this.getQuery());

  if (['Dispensed', 'Confirmed'].includes(prescription.status)) return next();

  const StockHistory = mongoose.model('StockHistory');
  const Medication = mongoose.model('Medication');

  // Loop through medications and reduce stock
  for (const medEntry of prescription.medications) {
    const medicationDoc = await Medication.findById(medEntry.medication);
    const quantityToReduce = medEntry.quantity || 0;

    if (medicationDoc && quantityToReduce > 0) {
      const oldQty = medicationDoc.quantity;
      medicationDoc.quantity = Math.max(0, medicationDoc.quantity - quantityToReduce);
      await medicationDoc.save();

      await StockHistory.create({
        medication: medicationDoc._id,
        type: 'dispense',
        quantityChanged: -quantityToReduce,
        newQuantity: medicationDoc.quantity,
        relatedPrescription: prescription._id,
        remarks: `Auto-reduced on prescription dispense.`,
      });

    }
  }

  next();
});


module.exports = models.Prescription || model('Prescription', prescriptionSchema);
