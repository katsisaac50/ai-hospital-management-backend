const mongoose = require('mongoose');
const Counter = require('./Counter');
const currencyUtils = require('../utils/currency.utils'); // Use shared utility

const billingSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required']
  },
  prescriptionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Prescription', 
    required: false 
  },
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^INV-\d{4}-\d+$/.test(v);
      },
      message: props => `${props.value} is not a valid invoice number format!`
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(v) {
        return v > this.date;
      },
      message: 'Due date must be after invoice date'
    }
  },
  items: [
    {
      description: {
        type: String,
        required: [true, 'Item description is required'],
        maxlength: [100, 'Description cannot exceed 100 characters']
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1']
      },
      unitPrice: {
        type: Number,
        required: true,
        min: [0, 'Unit price cannot be negative'],
        set: function(v) {
          return currencyUtils.toStorageFormat(v, this.parent().currency);
        },
        get: function(v) {
          return currencyUtils.fromStorageFormat(v, this.parent().currency);
        }
      },
      amount: {
        type: Number,
        set: function(v) {
          return currencyUtils.toStorageFormat(v, this.parent().currency);
        },
        get: function(v) {
          return currencyUtils.fromStorageFormat(v, this.parent().currency);
        }
      }
    }
  ],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    set: function(v) {
      return currencyUtils.toStorageFormat(v, this.currency);
    },
    get: function(v) {
      return currencyUtils.fromStorageFormat(v, this.currency);
    }
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
    set: function(v) {
      return currencyUtils.toStorageFormat(v, this.currency);
    },
    get: function(v) {
      return currencyUtils.fromStorageFormat(v, this.currency);
    }
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    set: function(v) {
      return currencyUtils.toStorageFormat(v, this.currency);
    },
    get: function(v) {
      return currencyUtils.fromStorageFormat(v, this.currency);
    }
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    set: function(v) {
      return currencyUtils.toStorageFormat(v, this.currency);
    },
    get: function(v) {
      return currencyUtils.fromStorageFormat(v, this.currency);
    }
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'UGX', 'KES', 'GBP', 'JPY'], // Added more currencies
    uppercase: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  payments: [
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      set: function(v) {
        return currencyUtils.toStorageFormat(v, this.parent().currency);
      },
      get: function(v) {
        return currencyUtils.fromStorageFormat(v, this.parent().currency);
      }
    },
    method: {
      type: String,
      enum: [
        'card', 'cash', 'bank_transfer', 'insurance', 'check', 
        'stripe', 'mobilepay', 'applepay', 'googlepay',
        'mpesa', 'airtel', 'orange', 'mtn' // Mobile money providers
      ],
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    transactionId: String,
    providerData: { // Add provider-specific data
      provider: String,
      paymentIntentId: String,
      phoneNumber: String,
      checkoutRequestId: String,
      receiptNumber: String,
      reference: String,
      rawResponse: mongoose.Schema.Types.Mixed
    },
    notes: String
  }
],
  insurance: {
    type: String,
    maxlength: [100, 'Insurance name cannot exceed 100 characters']
  },
  insuranceClaim: {
    isClaimed: {
      type: Boolean,
      default: false
    },
    claimAmount: {
      type: Number,
      min: 0
    },
    claimStatus: {
      type: String,
      enum: ['not-submitted', 'submitted', 'processing', 'approved', 'rejected', 'paid'],
      default: 'not-submitted'
    },
    claimReference: String
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
  toJSON: { 
    getters: true,    // This enables getters for JSON responses
    virtuals: true 
  },
  toObject: { 
    getters: true,    // This enables getters for toObject()
    virtuals: true 
  }
});

billingSchema.methods.applyPayment = async function(paymentData) {
  if (this.status === 'paid') {
    throw new Error('Invoice already paid in full');
  }
  
  // Convert payment amount to storage format using shared utility
  const paymentAmountStorage = currencyUtils.toStorageFormat(paymentData.amount, this.currency);
  
  const currentBalance = this.getBalanceDue();
  
  // Add tolerance for floating point comparison
  if (Math.abs(paymentData.amount - currentBalance) > 0.01) {
    throw new Error(`Payment amount (${paymentData.amount}) doesn't match current balance (${currentBalance})`);
  }

  // Push payment with storage format amount
  this.payments.push({
    amount: paymentAmountStorage,
    method: paymentData.method,
    date: paymentData.date || new Date(),
    transactionId: paymentData.transactionId,
    notes: paymentData.notes
  });
  
  // Update status based on new balance
  const newBalance = this.getBalanceDue();
  if (newBalance <= 0.01) {
    this.status = 'paid';
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }
  
  await this.save();
  return this;
};

billingSchema.methods.generateReceipt = function() {
  return {
    invoiceNumber: this.invoiceNumber,
    date: new Date(),
    patient: this.patient.name,
    items: this.items.map(item => ({
      ...item.toObject(),
      unitPrice: currencyUtils.fromStorageFormat(item.unitPrice, this.currency),
      amount: currencyUtils.fromStorageFormat(item.amount, this.currency)
    })),
    totalPaid: this.paidAmount,
    balanceDue: this.balanceDue,
    currency: this.currency
  };
};

// Auto-generate invoice number before saving
billingSchema.pre('validate', async function(next) {
  if (!this.isNew || this.invoiceNumber) return next();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const counter = await Counter.findOneAndUpdate(
      { id: 'invoiceNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).exec();

    this.invoiceNumber = `INV-${new Date().getFullYear()}-${counter.seq.toString().padStart(4, '0')}`;
    
    await session.commitTransaction();
    next();
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// Pre-save hooks
billingSchema.pre('save', function(next) {
  // Calculate items amount if not set (using display format for calculation)
  this.items.forEach(item => {
    if (!item.amount) {
      const displayUnitPrice = currencyUtils.fromStorageFormat(item.unitPrice, this.currency);
      const displayAmount = item.quantity * displayUnitPrice;
      item.amount = currencyUtils.toStorageFormat(displayAmount, this.currency);
    }
  });

  // Recalculate subtotal in display format, then convert to storage
  const displaySubtotal = this.items.reduce((sum, item) => {
    return sum + currencyUtils.fromStorageFormat(item.amount, this.currency);
  }, 0);
  this.subtotal = currencyUtils.toStorageFormat(displaySubtotal, this.currency);

  // Recalculate total in display format, then convert to storage
  const displayTax = currencyUtils.fromStorageFormat(this.tax, this.currency);
  const displayDiscount = currencyUtils.fromStorageFormat(this.discount, this.currency);
  const displayTotal = displaySubtotal + displayTax - displayDiscount;
  this.total = currencyUtils.toStorageFormat(displayTotal, this.currency);

  // Recalculate payment status using display amounts
  const paidDisplay = this.paidAmount;
  if (paidDisplay >= displayTotal) {
    this.paymentStatus = 'paid';
    this.status = 'paid';
  } else if (paidDisplay > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'pending';
  }

  // Mark as overdue if applicable
  if (this.dueDate < new Date() && this.paymentStatus !== 'paid') {
    this.status = 'overdue';
  }

  next();
});

// Instance methods
billingSchema.methods.getBalanceDue = function() {
  // Convert total to display format
  const totalDisplay = currencyUtils.fromStorageFormat(this.total, this.currency);
  
  // Subtract paid amount (already in display format from virtual)
  const balanceDue = totalDisplay - this.paidAmount;
  
  return parseFloat(balanceDue.toFixed(2));
};

billingSchema.methods.addPayment = function(payment) {
  this.payments.push(payment);
  return this.save();
};

billingSchema.methods.isOverdue = function() {
  return this.dueDate < new Date() && this.paymentStatus !== 'paid';
};

// Virtuals
billingSchema.virtual('balanceDue').get(function() {
  return this.getBalanceDue();
});

billingSchema.virtual('formattedDate').get(function() {
  if (!this.date || !(this.date instanceof Date)) {
    return '';
  }
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

billingSchema.virtual('paidAmount').get(function() {
  if (!this.payments || !Array.isArray(this.payments)) {
    return 0;
  }
  
  // Sum payments in storage format, then convert to display
  const paidStorage = this.payments.reduce((sum, payment) => {
    if (payment instanceof mongoose.Types.ObjectId) return sum;
    return sum + (payment.amount || 0);
  }, 0);

  return currencyUtils.fromStorageFormat(paidStorage, this.currency);
});

// Virtual for claim reference
billingSchema.virtual('claim', {
  ref: 'Claim',
  localField: '_id',
  foreignField: 'billing',
  justOne: true
});

// Query helpers
billingSchema.query.byStatus = function(status) {
  return this.where({ status });
};

billingSchema.query.overdue = function() {
  return this.where('dueDate').lt(new Date()).where('paymentStatus').ne('paid');
};

billingSchema.query.byPatient = function(patientId) {
  return this.where({ patient: patientId });
};

// Indexes
billingSchema.index({ patient: 1 });
billingSchema.index({ date: -1 });
billingSchema.index({ dueDate: 1 });
billingSchema.index({ paymentStatus: 1 });
billingSchema.index({ status: 1 });
// billingSchema.index({ invoiceNumber: 1 }, { unique: true });

const Billing = mongoose.model('Billing', billingSchema);

module.exports = Billing;






















// const mongoose = require('mongoose');
// const Counter = require('./Counter');

// const billingSchema = new mongoose.Schema({
//   patient: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'Patient',
//     required: [true, 'Patient reference is required']
//   },
//   invoiceNumber: {
//     type: String,
//     required: [true, 'Invoice number is required'],
//     unique: true,
//     validate: {
//       validator: function(v) {
//         return /^INV-\d{4}-\d+$/.test(v);
//       },
//       message: props => `${props.value} is not a valid invoice number format!`
//     }
//   },
//   date: {
//     type: Date,
//     default: Date.now
//   },
//   dueDate: {
//     type: Date,
//     required: [true, 'Due date is required'],
//     validate: {
//       validator: function(v) {
//         return v > this.date;
//       },
//       message: 'Due date must be after invoice date'
//     }
//   },
//   items: [
//     {
//       description: {
//         type: String,
//         required: [true, 'Item description is required'],
//         maxlength: [100, 'Description cannot exceed 100 characters']
//       },
//       quantity: {
//         type: Number,
//         required: true,
//         min: [1, 'Quantity must be at least 1']
//       },
//       unitPrice: {
//         type: Number,
//         required: true,
//         min: [0, 'Unit price cannot be negative']
//       },
//       amount: {
//         type: Number,
//         validate: {
//           validator: function(v) {
//             return v === this.quantity * this.unitPrice;
//           },
//           message: props => `Amount ${props.value} should equal quantity × unitPrice`
//         }
//       }
//     }
//   ],
//   subtotal: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   tax: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   discount: {
//     type: Number,
//     default: 0,
//     min: 0
//   },
//   total: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   currency: {
//     type: String,
//     default: 'USD',
//     enum: ['USD', 'EUR', 'GBP', 'JPY'],
//     uppercase: true
//   },
//   paymentStatus: {
//     type: String,
//     enum: ['pending', 'partial', 'paid', 'failed', 'refunded'],
//     default: 'pending'
//   },
//   status: {
//     type: String,
//     enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
//     default: 'draft'
//   },
//   payments: [
//     {
//       amount: {
//         type: Number,
//         required: true,
//         min: 0.01
//       },
//       method: {
//         type: String,
//         enum: ['cash', 'card', 'insurance', 'bank-transfer', 'check', 'stripe', 'other'],
//         required: true
//       },
//       date: {
//         type: Date,
//         default: Date.now
//       },
//       transactionId: String,
//       notes: String
//     }
//   ],
//   insurance: {
//     type: String,
//     maxlength: [100, 'Insurance name cannot exceed 100 characters']
//   },
//   insuranceClaim: {
//     isClaimed: {
//       type: Boolean,
//       default: false
//     },
//     claimAmount: {
//       type: Number,
//       min: 0
//     },
//     claimStatus: {
//       type: String,
//       enum: ['not-submitted', 'submitted', 'processing', 'approved', 'rejected', 'paid'],
//       default: 'not-submitted'
//     },
//     claimReference: String
//   },
//   notes: {
//     type: String,
//     maxlength: [500, 'Notes cannot exceed 500 characters']
//   },
//   createdBy: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   updatedBy: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'User'
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// billingSchema.methods.applyPayment = async function(paymentData) {
//   if (this.status === 'paid') {
//     throw new Error('Invoice already paid in full');
//   }
  
//   // Round payment amount to avoid floating point issues
//   paymentData.amount = parseFloat(paymentData.amount.toFixed(2));
  
//   const currentBalance = this.getBalanceDue();
  
//   // Add tolerance for floating point comparison
//   if (Math.abs(paymentData.amount - currentBalance) > 0.01) {
//     throw new Error(`Payment amount (${paymentData.amount}) doesn't match current balance (${currentBalance})`);
//   }

//   const payment = await Payment.create({
//     ...paymentData,
//     billing: this._id,
//     patient: this.patient
//   });

//   this.payments.push(payment._id);
  
//   // Update status based on new balance
//   const newBalance = this.getBalanceDue();
//   if (newBalance <= 0.01) { // Account for floating point precision
//     this.status = 'paid';
//     this.paymentStatus = 'paid';
//   } else {
//     this.paymentStatus = 'partial';
//   }
  
//   await this.save();
//   return payment;
// };

// billingSchema.methods.generateReceipt = function() {
//   return {
//     invoiceNumber: this.invoiceNumber,
//     date: new Date(),
//     patient: this.patient.name,
//     items: this.items,
//     totalPaid: this.paidAmount,
//     balanceDue: this.balanceDue
//   };
// };

// // Auto-generate invoice number before saving
// billingSchema.pre('validate', async function(next) {
//   if (!this.isNew || this.invoiceNumber) return next();

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const counter = await Counter.findOneAndUpdate(
//       { id: 'invoiceNumber' },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, session }
//     ).exec();

//     this.invoiceNumber = `INV-${new Date().getFullYear()}-${counter.seq.toString().padStart(4, '0')}`;
    
//     await session.commitTransaction();
//     next();
//   } catch (error) {
//     await session.abortTransaction();
//     next(error);
//   } finally {
//     session.endSession();
//   }
// });

// // Pre-save hooks
// billingSchema.pre('save', function(next) {
//   // Calculate items amount if not set
//   this.items.forEach(item => {
//     if (!item.amount) {
//       item.amount = item.quantity * item.unitPrice;
//     }
//   });

//   // Recalculate subtotal
//   this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);

//   // Recalculate total
//   this.total = this.subtotal + (this.tax || 0) - (this.discount || 0);

//   // Recalculate payment status
//   if (this.payments.length > 0) {
//     const paidAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
//     if (paidAmount >= this.total) {
//       this.paymentStatus = 'paid';
//       this.status = 'paid';
//     } else if (paidAmount > 0) {
//       this.paymentStatus = 'partial';
//     }
//   }

//   // Mark as overdue if applicable
//   if (this.dueDate < new Date() && this.paymentStatus !== 'paid') {
//     this.status = 'overdue';
//   }

//   next();
// });


// // Instance methods
// billingSchema.methods.getBalanceDue = function() {
//   const { toStorageFormat, fromStorageFormat } = require('../utils/currency.utils');
  
//   // Ensure payments exists and is an array
//   if (!this.payments || !Array.isArray(this.payments)) {
//     return this.total; // Return full amount if no payments exist
//   }
  
//   const paidAmount = this.payments.reduce((sum, p) => {
//     return sum + toStorageFormat(p.amount, this.currency);
//   }, 0);

//   const totalInSmallestUnit = toStorageFormat(this.total, this.currency);
//   const balanceDueInSmallestUnit = totalInSmallestUnit - paidAmount;

//   return fromStorageFormat(balanceDueInSmallestUnit, this.currency);
// };
// // billingSchema.methods.getBalanceDue = function() {
// //   const paidAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
// //   return parseFloat((this.total - paidAmount).toFixed(2));
// // };

// billingSchema.methods.addPayment = function(payment) {
//   this.payments.push(payment);
//   return this.save();
// };

// billingSchema.methods.isOverdue = function() {
//   return this.dueDate < new Date() && this.paymentStatus !== 'paid';
// };

// billingSchema.set('toJSON', {
//   virtuals: true,
//   transform: (_doc, ret) => {
//     ret.id = ret._id;
//     delete ret._id;
//     delete ret.__v;
//     return ret;
//   }
// });


// // // Static methods
// // billingSchema.statics.generateInvoiceNumber = async function() {
// //   const lastInvoice = await this.findOne().sort({ invoiceNumber: -1 });
// //   if (!lastInvoice) {
// //     return `INV-${new Date().getFullYear()}-0001`;
// //   }
// //   const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-').pop(), 10);
// //   return `INV-${new Date().getFullYear()}-${(lastNumber + 1).toString().padStart(4, '0')}`;
// // };

// // Query helpers
// billingSchema.query.byStatus = function(status) {
//   return this.where({ status });
// };

// billingSchema.query.overdue = function() {
//   return this.where('dueDate').lt(new Date()).where('paymentStatus').ne('paid');
// };


// billingSchema.query.byPatient = function(patientId) {
//   return this.where({ patient: patientId });
// };

// // Virtuals
// billingSchema.virtual('balanceDue').get(function() {
//   return this.getBalanceDue();
// });

// billingSchema.virtual('formattedDate').get(function() {
//   if (!this.date || !(this.date instanceof Date)) {
//     return ''; // or return a default formatted date if preferred
//   }
//   return this.date.toLocaleDateString('en-US', {
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric'
//   });
// });

// billingSchema.virtual('paidAmount').get(function() {
//   if (!this.payments || !Array.isArray(this.payments)) {
//     return 0;
//   }
//   return this.payments.reduce((sum, p) => sum + p.amount, 0);
// });


// // Indexes
// // billingSchema.index({ invoiceNumber: 1 }, { unique: true });
// billingSchema.index({ patient: 1 });
// billingSchema.index({ date: -1 });
// billingSchema.index({ dueDate: 1 });
// billingSchema.index({ paymentStatus: 1 });
// billingSchema.index({ status: 1 });
// billingSchema.index({ billingId: 1 });
// billingSchema.index({ 'payments.paymentIntentId': 1 });
// // paymentSchema.index({ status: 1 });

// const Billing = mongoose.model('Billing', billingSchema);

// module.exports = Billing;