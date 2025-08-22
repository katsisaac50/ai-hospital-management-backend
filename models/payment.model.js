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
  method: {
    type: String,
    required: true,
    enum: ["Credit Card", "Insurance", "card", "Cash", "Bank Transfer", "Stripe"],
  },
  status: {
    type: String,
    required: true,
    enum: ["Completed", "Processing", "Failed", "Pending"],
    default: "Pending",
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
  notes: {
    type: String,
  },
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true },
});

// Pre-save hooks
PaymentSchema.pre('save', async function(next) {
  // Generate unique IDs
  if (!this.paymentId) {
    let isUnique = false;
    while (!isUnique) {
      const newId = `PAY${Math.floor(1000 + Math.random() * 9000)}`;
      if (!await this.constructor.findOne({ paymentId: newId })) {
        this.paymentId = newId;
        isUnique = true;
      }
    }
  }

  if (!this.transactionId) {
    let isUnique = false;
    while (!isUnique) {
      const newId = `TXN${uuidv4().replace(/-/g, '').substring(0, 9).toUpperCase()}`;
      if (!await this.constructor.findOne({ transactionId: newId })) {
        this.transactionId = newId;
        isUnique = true;
      }
    }
  }

  // Get billing record
  this._billing = await Billing.findById(this.billing).select('total payments currency');
  if (!this._billing) {
    throw new Error('Billing record not found');
  }

  // Validate payment amount using the SAME currency utils as Billing
  const paidAmount = this._billing.payments.reduce((sum, p) => {
    return sum + p.amount;
  }, 0);

  const totalInSmallestUnit = this._billing.total;
  const paymentAmount = this.amount; // Already in storage format
  const balanceDue = totalInSmallestUnit - paidAmount;

  if (paymentAmount > balanceDue) {
    throw new Error(
      `Payment of ${currencyUtils.fromStorageFormat(paymentAmount, this._billing.currency)} ${this._billing.currency} ` +
      `exceeds balance due of ${currencyUtils.fromStorageFormat(balanceDue, this._billing.currency)}`
    );
  }

  next();
});

// Update billing after payment
PaymentSchema.post('save', async function(doc, next) {
  try {
    const billing = await Billing.findById(doc.billing);
    if (!billing) throw new Error('Billing record not found');

    // Use the SAME conversion as Billing model expects
    billing.payments.push({
      _id: doc._id,
      amount: doc.amount, // This is already in storage format from setter
      method: doc.method,
      date: doc.date,
      transactionId: doc.transactionId
    });
    
    // Recalculate status using consistent currency handling
    const paidAmount = billing.payments.reduce((sum, p) => {
      return sum + p.amount; // p.amount should be in storage format
    }, 0);

    if (paidAmount >= billing.total) { // Both in storage format
      billing.paymentStatus = 'paid';
      billing.status = 'paid';
    } else if (paidAmount > 0) {
      billing.paymentStatus = 'partial';
    }
    
    await billing.save();
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Payment", PaymentSchema);






// const mongoose = require("mongoose");
// const { v4: uuidv4 } = require('uuid');
// const Billing = require("./billing.model");

// // Currency configuration
// const currencyConfig = {
//   USD: { symbol: '$', baseUnit: 100 }, // cents
//   EUR: { symbol: '€', baseUnit: 100 }, // cents
//   UGX: { symbol: 'USh', baseUnit: 1 }, // no subdivision
//   JPY: { symbol: '¥', baseUnit: 1 }, // Yen also typically uses whole numbers
//   // Add other currencies as needed
// };

// // Helper functions
// const toStorageFormat = (amount, currency) => {
//   return Math.round(amount * currencyConfig[currency].baseUnit);
// };

// const fromStorageFormat = (amount, currency) => {
//   return amount / currencyConfig[currency].baseUnit;
// };

// const PaymentSchema = new mongoose.Schema({
//   paymentId: {
//     type: String,
//     unique: true,
//     default: () => `PAY${Math.floor(1000 + Math.random() * 9000)}`,
//   },
//   patient: {
//     type: mongoose.Schema.ObjectId,
//     ref: "Patient",
//     required: true,
//   },
//   billing: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'Billing',
//     required: true
//   },
//   amount: {
//     type: Number,
//     required: true,
//     set: function(v) {
//       const billing = this.billing || this._billing;
//       const currency = billing?.currency || 'USD';
//       return toStorageFormat(v, currency);
//     },
//     get: function(v) {
//       const billing = this.billing || this._billing;
//       const currency = billing?.currency || 'USD';
//       return fromStorageFormat(v, currency);
//     }
//   },
//   method: {
//     type: String,
//     required: true,
//     enum: ["Credit Card", "Insurance", "card", "Cash", "Bank Transfer", "Stripe"],
//   },
//   status: {
//     type: String,
//     required: true,
//     enum: ["Completed", "Processing", "Failed", "Pending"],
//     default: "Pending",
//   },
//   date: {
//     type: Date,
//     default: Date.now,
//   },
//   transactionId: {
//     type: String,
//     unique: true,
//     default: () => `TXN${uuidv4().replace(/-/g, '').substring(0, 9).toUpperCase()}`
//   },
//   notes: {
//     type: String,
//   },
// }, {
//   timestamps: true,
//   toJSON: { getters: true, virtuals: true },
//   toObject: { getters: true, virtuals: true },
// });

// // Pre-save hooks
// PaymentSchema.pre('save', async function(next) {
//   // Generate unique IDs if needed
//   if (!this.paymentId) {
//     let isUnique = false;
//     while (!isUnique) {
//       const newId = `PAY${Math.floor(1000 + Math.random() * 9000)}`;
//       if (!await this.constructor.findOne({ paymentId: newId })) {
//         this.paymentId = newId;
//         isUnique = true;
//       }
//     }
//   }

//   if (!this.transactionId) {
//     let isUnique = false;
//     while (!isUnique) {
//       const newId = `TXN${uuidv4().replace(/-/g, '').substring(0, 9).toUpperCase()}`;
//       if (!await this.constructor.findOne({ transactionId: newId })) {
//         this.transactionId = newId;
//         isUnique = true;
//       }
//     }
//   }

//   // Get billing record with currency info
//   this._billing = await Billing.findById(this.billing).select('total payments currency');
//   if (!this._billing) {
//     throw new Error('Billing record not found');
//   }

//   // Validate payment amount
//   const paidAmount = this._billing.payments.reduce((sum, p) => {
//     return sum + toStorageFormat(p.amount, this._billing.currency);
//   }, 0);

//   const totalInSmallestUnit = toStorageFormat(this._billing.total, this._billing.currency);
//   const paymentAmount = this.amount; // Already in smallest units from setter
//   const balanceDue = totalInSmallestUnit - paidAmount;

//   if (paymentAmount > balanceDue) {
//     throw new Error(
//       `Payment of ${fromStorageFormat(paymentAmount, this._billing.currency)} ${this._billing.currency} ` +
//       `exceeds balance due of ${fromStorageFormat(balanceDue, this._billing.currency)}`
//     );
//   }

//   next();
// });

// // Update billing after payment is created
// PaymentSchema.post('save', async function(doc, next) {
//   try {
//     const billing = await Billing.findById(doc.billing);
//     if (!billing) throw new Error('Billing record not found');

//     billing.payments.push({
//       _id: doc._id,
//       amount: doc.amount,
//       method: doc.method,
//       date: doc.date,
//       transactionId: doc.transactionId
//       // Add other required fields as needed
//     });
    
//     // Recalculate status in smallest units
//     const paidAmount = billing.payments.reduce((sum, p) => {
//       return sum + toStorageFormat(p.amount, billing.currency);
//     }, 0);

//     const totalInSmallestUnit = toStorageFormat(billing.total, billing.currency);

//     if (paidAmount >= totalInSmallestUnit) {
//       billing.paymentStatus = 'paid';
//       billing.status = 'paid';
//     } else if (paidAmount > 0) {
//       billing.paymentStatus = 'partial';
//     }
    
//     await billing.save();
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = mongoose.model("Payment", PaymentSchema);