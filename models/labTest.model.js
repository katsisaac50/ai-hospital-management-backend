const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    patientName: { type: String, required: [true, 'Please add patient name'] },

    LaboratoryRecordNumber: { type: String, unique: true },

    testType: { type: String, required: true },

    orderedBy: { type: String, required: true },
    orderedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    priority: { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    orderDate: { type: Date, default: Date.now },

    results: { type: mongoose.Schema.Types.Mixed },
    technicianNotes: { type: String },
    completedDate: { type: Date },

    category: {
      type: String,
      enum: ['hematology', 'biochemistry', 'microbiology', 'pathology', 'radiology'],
      required: true,
    },

    description: String,
    notes: String,

    price: { type: Number, required: true, min: 0 },
    turnaroundTime: { type: Number, required: true }, // hours
    sampleType: { type: String, required: true },
    preparationInstructions: String,

    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  },
  { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' }
);

// 🔹 Helper function for generating LaboratoryRecordNumber
async function generateLabRecordNumber(doc) {
  if (!doc.LaboratoryRecordNumber) {
    const Counter = mongoose.model('Counter');
    const counter = await Counter.findOneAndUpdate(
      { id: 'lab_lrn' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    doc.LaboratoryRecordNumber = `LAB${String(counter.seq).padStart(4, '0')}`;
  }
}

// ✅ Pre-save hook (works for `.save()`)
labTestSchema.pre('save', async function (next) {
  await generateLabRecordNumber(this);
  next();
});

// ✅ Pre-insertMany hook (works for `.insertMany()`)
labTestSchema.pre('insertMany', async function (next, docs) {
  for (let doc of docs) {
    await generateLabRecordNumber(doc);
  }
  next();
});

// ✅ Index for faster category-based queries
labTestSchema.index({ category: 1 });

// ✅ Text index for search
labTestSchema.index(
  { patientName: 'text', description: 'text', testType: 'text' },
  { name: 'LabTestTextIndex' }
);

module.exports = mongoose.model('LabTest', labTestSchema);
