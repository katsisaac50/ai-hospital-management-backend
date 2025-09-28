const mongoose = require('mongoose');
const Counter = require('./Counter');

const auditEntrySchema = new mongoose.Schema({
  action: { type: String, enum: ["create", "update", "delete", "restore"], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["doctor", "nurse", "admin"], required: true },
  changes: { type: Object }, // store diff or summary of changes
  timestamp: { type: Date, default: Date.now }
});

const encounterSchema = new mongoose.Schema({
  visitDate: { type: Date, default: Date.now },
  encounterId: { type: String, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  reasonForVisit: String,
  historyOfPresentIllness: String,
  chiefComplaints: [String],
  vitals: {
    temperature: Number,
    bloodPressure: String,   // Example: "120/80"
    heartRate: Number,
    respiratoryRate: Number,
    weight: Number,
    height: Number,
    spo2: Number,
  },
  differentialDiagnosis: [{ condition: String }],
  diagnosis: [{
    condition: String,
    notes: String,
  }],
  treatment: [{
    description: String,
    notes: String,
  }],
  followUp: {
    date: Date,
    instructions: String,
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  auditTrail: [auditEntrySchema],
},
  { timestamps: true }
);

// Auto-generate incremental encounterId
encounterSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { id: "encounter" },          
      { $inc: { seq: 1 } },         
      { new: true, upsert: true }
    );

    if (!counter) {
      console.error("Counter not found or failed to upsert");
      return next(new Error("Failed to generate encounter counter"));
    }

    this.encounterId = `ENC-${String(counter.seq).padStart(4, "0")}`;
    next();
  } catch (err) {
    console.error("Counter hook error:", err);
    next(err);
  }
});

module.exports = mongoose.model("Encounter", encounterSchema);