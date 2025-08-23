const mongoose = require('mongoose');
const Counter = require('./Counter');

const claimSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'Claim ID is required'],
    unique: true
  },
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required']
  },
  billing: {
    type: mongoose.Schema.ObjectId,
    ref: 'Billing',
    required: [true, 'Billing reference is required']
  },
  payment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Payment'
  },
  submittedDate: {
    type: Date,
    required: [true, 'Submission date is required'],
    default: Date.now
  },
  processedDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for patient name (derived from patient reference)
claimSchema.virtual('patientName').get(function() {
  return this.populated('patient') ? this.patient.name : '';
});

// Virtual for provider (derived from billing insurance)
claimSchema.virtual('provider').get(function() {
  return this.populated('billing') ? this.billing.insurance : '';
});

// Virtual for amount (derived from billing total or insurance claim amount)
claimSchema.virtual('amount').get(function() {
  if (this.populated('billing')) {
    return this.billing.insuranceClaim.claimAmount || this.billing.total;
  }
  return 0;
});

// Virtual for status (derived from billing insurance claim status)
claimSchema.virtual('status').get(function() {
  if (this.populated('billing')) {
    const claimStatus = this.billing.insuranceClaim.claimStatus;
    // Map billing claim status to claim status
    const statusMap = {
      'not-submitted': 'Pending',
      'submitted': 'Under Review',
      'processing': 'Under Review',
      'approved': 'Approved',
      'rejected': 'Denied',
      'paid': 'Approved'
    };
    return statusMap[claimStatus] || 'Pending';
  }
  return 'Pending';
});

// Auto-generate claim ID before saving
claimSchema.pre('validate', async function(next) {
  if (!this.isNew || this.id) return next();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const counter = await Counter.findOneAndUpdate(
      { id: 'claimNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).exec();

    this.id = `CLM-${counter.seq.toString().padStart(4, '0')}`;
    
    await session.commitTransaction();
    next();
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// Pre-save hook to sync with billing record
claimSchema.pre('save', async function(next) {
  try {
    // Populate billing if not already populated
    if (!this.populated('billing')) {
      await this.populate('billing');
    }
    
    // Update billing insurance claim details
    if (this.billing) {
      const Billing = mongoose.model('Billing');
      await Billing.findByIdAndUpdate(
        this.billing._id,
        { 
          $set: { 
            'insuranceClaim.isClaimed': true,
            'insuranceClaim.claimReference': this.id
          } 
        }
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for formatted dates
claimSchema.virtual('formattedSubmittedDate').get(function() {
  return this.submittedDate.toISOString().split('T')[0];
});

claimSchema.virtual('formattedProcessedDate').get(function() {
  return this.processedDate ? this.processedDate.toISOString().split('T')[0] : null;
});

// Query helpers
claimSchema.query.byStatus = function(status) {
  // Map claim status to billing insurance claim status
  const statusMap = {
    'Pending': 'not-submitted',
    'Under Review': ['submitted', 'processing'],
    'Approved': ['approved', 'paid'],
    'Denied': 'rejected'
  };
  
  const billingStatus = statusMap[status];
  
  if (Array.isArray(billingStatus)) {
    return this.populate({
      path: 'billing',
      match: { 'insuranceClaim.claimStatus': { $in: billingStatus } }
    });
  }
  
  return this.populate({
    path: 'billing',
    match: { 'insuranceClaim.claimStatus': billingStatus }
  });
};

claimSchema.query.byProvider = function(provider) {
  return this.populate({
    path: 'billing',
    match: { insurance: provider }
  });
};

claimSchema.query.byPatient = function(patientId) {
  return this.where({ patient: patientId });
};

// Indexes
claimSchema.index({ patient: 1 });
claimSchema.index({ billing: 1 });
claimSchema.index({ 'billing.insurance': 1 });
claimSchema.index({ submittedDate: -1 });
claimSchema.index({ id: 1 }, { unique: true });

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;