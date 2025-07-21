const mongoose = require('mongoose');
const Counter = require('./Counter');

const medicalHistorySchema = new mongoose.Schema({
  condition: { type: String, required: true },
  diagnosedAt: { type: Date, required: true },
  notes: { type: String },
});

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
  },
  medicalRecordNumber: {
    type: String,
    unique: true,
  },
  firstName: String,
  lastName: String,
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true,
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  phone: {
    type: String,
    validate: {
      validator: v => !v || /^\+?\d{7,15}$/.test(v),
      message: props => `${props.value} is not a valid phone number!`,
    },
  },
  email: {
    type: String,
    lowercase: true,
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  emergencyPhone: String, // for UI convenience
  medicalHistory: [medicalHistorySchema],
  allergies: [String],
  currentMedications: [
    {
      name: String,
      dosage: String,
      frequency: String,
    },
  ],
  insuranceProvider: String,
  insuranceNumber: String,
  insurance: {
    provider: String,
    policyNumber: String,
    validUntil: Date,
  },
  lastVisit: Date,
  admittedTo: {
  type: String,
  enum: ['general', 'ICU', 'ER', null],
},
  nextAppointment: Date,
  status: {
    type: String,
    enum: ['active', 'inactive', 'critical'],
    default: 'active',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


patientSchema.pre('save', async function (next) {
  if (!this.medicalRecordNumber) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: 'patient_mrn' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.medicalRecordNumber = `MRN${String(counter.seq).padStart(4, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }

});

patientSchema.virtual('fullName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

patientSchema.index({ isActive: 1 });
patientSchema.index({ status: 1 });

patientSchema.methods.getFullAddress = function () {
  const { street, city, state, postalCode, country } = this.address || {};
  return [street, city, state, postalCode, country].filter(Boolean).join(', ');
}

// Map _id to id in JSON output
patientSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  if (ret.insurance && !ret.insurance.provider) delete ret.insurance;
},
});

module.exports = mongoose.model("Patient", patientSchema);
