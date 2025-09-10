const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');
const Billing = require("./billing.model");
const currencyUtils = require("../utils/currency.utils"); // Use shared utility

const PaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    default: () => `PAY${Math.floor(1000 + Math.random() * 9000)}`,
  },
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: "Patient",
    required: true,
  },
  billing: {
    type: mongoose.Schema.ObjectId,
    ref: 'Billing',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    set: function(v) {
    // For card payments, the amount is already in storage format (cents)
    // from the Stripe payment intent creation
    console.log('Setting amount:', v, 'for method:', this.method);
    if (this.method === 'card') {
      return v; // Already in storage format, no conversion needed
    }
    
    // For other payment methods, convert to storage format
    const billing = this.billing || this._billing;
    const currency = billing?.currency || 'USD';
    return currencyUtils.toStorageFormat(v, currency);
  },
    get: function(v) {
      const billing = this.billing || this._billing;
      const currency = billing?.currency || 'USD';
      return currencyUtils.fromStorageFormat(v, currency);
    }
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'UGX', 'KES', 'GBP', 'JPY']
  },
  method: {
  type: String,
  required: true,
  enum: [
    "card", "cash", "bank_transfer", "insurance", "stripe",
    "mobilepay", "applepay", "googlepay", "mpesa", "airtel", 
    "orange", "mtn"
  ],
},
  status: {
    type: String,
    required: true,
    enum: ["pending", "processing", "completed", "failed", "refunded"],
    default: "pending",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  transactionId: {
    type: String,
    unique: true,
    default: () => `TXN${uuidv4().replace(/-/g, '').substring(0, 9).toUpperCase()}`
  },
   providerData: {
    provider: String,           // Specific provider name (e.g., "stripe", "mobilepay")
    paymentIntentId: String,    // For Stripe and similar providers
    clientSecret: String,       // For client-side confirmation
    phoneNumber: String,        // For mobile money payments
    checkoutRequestId: String,  // For M-Pesa and similar
    merchantRequestId: String,  // For M-Pesa
    receiptNumber: String,      // For mobile money
    rawResponse: mongoose.Schema.Types.Mixed, // Complete provider response
    redirectUrl: String,        // For redirect-based payments
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceId: String,
  },
  notes: {
    type: String,
  },
  expirationTime: {
    type: Date,
    index: true,
    default: function() {
      // Default expiration: 30 minutes from creation
      return new Date(Date.now() + 30 * 60 * 1000);
    }
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  lastRetryAt: Date,
  paymentUrl: String, // For payment methods that redirect to external pages
  qrCodeData: String, // For QR code based payments
  
  // Additional tracking
  ipAddress: String,
  userAgent: String,
  deviceFingerprint: String,

  processedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true },
});

// Indexes for better query performance
PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ transactionId: 1 });
PaymentSchema.index({ billing: 1 });
PaymentSchema.index({ patient: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ method: 1 });
PaymentSchema.index({ 'providerData.provider': 1 });
PaymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
PaymentSchema.virtual('amountDisplay').get(function() {
  return currencyUtils.fromStorageFormat(this.amount, this.currency);
});

// Virtual for formatted date
PaymentSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for expiration status
PaymentSchema.virtual('isExpired').get(function() {
  return this.expirationTime < new Date();
});

// Virtual for canRetry
PaymentSchema.virtual('canRetry').get(function() {
  return this.retryCount < this.maxRetries && !this.isExpired;
});

// Pre-save hooks
PaymentSchema.pre('save', async function(next) {
  try {
    // Generate unique IDs if not provided
    if (!this.paymentId) {
      this.paymentId = `PAY${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (!this.transactionId) {
      this.transactionId = `TXN${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    }

    // Get billing record for validation
    if (this.isNew || this.isModified('amount') || this.isModified('billing')) {
      this._billing = await Billing.findById(this.billing).select('total payments currency invoiceNumber');
      
      if (!this._billing) {
        throw new Error('Billing record not found');
      }

      // Set currency from billing
      this.currency = this._billing.currency;
      
      // Set invoice number
      this.invoiceNumber = this._billing.invoiceNumber;

      // Validate payment amount
      const paidAmount = this._billing.payments.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = this._billing.total - paidAmount;
      const paymentAmount = this.amount; // Already in storage format

      if (paymentAmount > balanceDue + 0.01) { // Allow for small rounding differences
        throw new Error(
          `Payment of ${currencyUtils.fromStorageFormat(paymentAmount, this.currency)} ${this.currency} ` +
          `exceeds balance due of ${currencyUtils.fromStorageFormat(balanceDue, this.currency)}`
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Update billing after payment
PaymentSchema.post('save', async function(doc, next) {
  try {
    const billing = await Billing.findById(doc.billing);
    if (!billing) throw new Error('Billing record not found');

    // Check if this payment already exists in billing
    const existingPaymentIndex = billing.payments.findIndex(
      p => p._id && p._id.toString() === doc._id.toString()
    );

    if (existingPaymentIndex === -1) {
      // Add new payment to billing
      billing.payments.push({
        _id: doc._id,
        amount: doc.amount,
        method: doc.method,
        date: doc.date,
        transactionId: doc.transactionId,
        providerData: doc.providerData
      });
    } else {
      // Update existing payment
      billing.payments[existingPaymentIndex] = {
        _id: doc._id,
        amount: doc.amount,
        method: doc.method,
        date: doc.date,
        transactionId: doc.transactionId,
        providerData: doc.providerData
      };
    }

    // Recalculate status
    const paidAmount = billing.payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (paidAmount >= billing.total - 0.01) { // Allow for rounding
      billing.paymentStatus = 'paid';
      billing.status = 'paid';
    } else if (paidAmount > 0) {
      billing.paymentStatus = 'partial';
    } else {
      billing.paymentStatus = 'pending';
    }

    await billing.save();
    next();
  } catch (err) {
    console.error('Error updating billing after payment:', err);
    next(err);
  }
});

// Static methods
PaymentSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

PaymentSchema.statics.findByMethod = function(method) {
  return this.find({ method });
};

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Find recent payments for a given patient.
 * @param {ObjectId} patientId - ObjectId of the patient to search for
 * @param {number} [limit=10] - Number of payments to return
 * @return {Promise<Payment[]>}
 */
/*******  714d0ecd-c9cf-46ec-9ae3-12459ea5c74a  *******/PaymentSchema.statics.findByProvider = function(provider) {
  return this.find({ 'providerData.provider': provider });
};


PaymentSchema.statics.findRecentByPatient = function(patientId, limit = 10) {
  return this.find({ patient: patientId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance methods
PaymentSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  if (notes) {
    this.notes = this.notes ? `${this.notes}\n${notes}` : notes;
  }
  return this.save();
};

PaymentSchema.methods.toJSON = function() {
  const obj = this.toObject();
  // Convert amount to display format for JSON output
  obj.amount = currencyUtils.fromStorageFormat(obj.amount, obj.currency);
  return obj;
};

module.exports = mongoose.model("Payment", PaymentSchema);
