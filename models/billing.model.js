const mongoose = require('mongoose');
const Counter = require('./Counter');

const billingSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required']
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
        min: [0, 'Unit price cannot be negative']
      },
      amount: {
        type: Number,
        validate: {
          validator: function(v) {
            return v === this.quantity * this.unitPrice;
          },
          message: props => `Amount ${props.value} should equal quantity × unitPrice`
        }
      }
    }
  ],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'JPY'],
    uppercase: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
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
        min: 0.01
      },
      method: {
        type: String,
        enum: ['cash', 'card', 'insurance', 'bank-transfer', 'check', 'other'],
        required: true
      },
      date: {
        type: Date,
        default: Date.now
      },
      transactionId: String,
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

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
  // Calculate items amount if not set
  this.items.forEach(item => {
    if (!item.amount) {
      item.amount = item.quantity * item.unitPrice;
    }
  });

  // Recalculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);

  // Recalculate total
  this.total = this.subtotal + (this.tax || 0) - (this.discount || 0);

  // Recalculate payment status
  if (this.payments.length > 0) {
    const paidAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidAmount >= this.total) {
      this.paymentStatus = 'paid';
      this.status = 'paid';
    } else if (paidAmount > 0) {
      this.paymentStatus = 'partial';
    }
  }

  // Mark as overdue if applicable
  if (this.dueDate < new Date() && this.paymentStatus !== 'paid') {
    this.status = 'overdue';
  }

  next();
});


// Instance methods
billingSchema.methods.getBalanceDue = function() {
  const paidAmount = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return this.total - paidAmount;
};

billingSchema.methods.addPayment = function(payment) {
  this.payments.push(payment);
  return this.save();
};

billingSchema.methods.isOverdue = function() {
  return this.dueDate < new Date() && this.paymentStatus !== 'paid';
};

billingSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});


// // Static methods
// billingSchema.statics.generateInvoiceNumber = async function() {
//   const lastInvoice = await this.findOne().sort({ invoiceNumber: -1 });
//   if (!lastInvoice) {
//     return `INV-${new Date().getFullYear()}-0001`;
//   }
//   const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-').pop(), 10);
//   return `INV-${new Date().getFullYear()}-${(lastNumber + 1).toString().padStart(4, '0')}`;
// };

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

// Virtuals
billingSchema.virtual('balanceDue').get(function() {
  return this.getBalanceDue();
});

billingSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

billingSchema.virtual('paidAmount').get(function() {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});


// Indexes
// billingSchema.index({ invoiceNumber: 1 }, { unique: true });
billingSchema.index({ patient: 1 });
billingSchema.index({ date: -1 });
billingSchema.index({ dueDate: 1 });
billingSchema.index({ paymentStatus: 1 });
billingSchema.index({ status: 1 });

const Billing = mongoose.model('Billing', billingSchema);

module.exports = Billing;