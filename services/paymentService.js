const Payment = require('../models/payment.model');
const Billing = require('../models/billing.model');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const currencyUtils = require("../utils/currency.utils");

class PaymentService {

  // Add this method to your PaymentService class
async processStripePayment(paymentIntentId, expectedAmount = null) {
  try {
    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Verify the payment intent status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment intent status is ${paymentIntent.status}, expected succeeded`);
    }
    
    // Verify amount if provided
    if (expectedAmount !== null) {
      const expectedAmountInCents = Math.round(expectedAmount * 100);
      if (paymentIntent.amount !== expectedAmountInCents) {
        throw new Error(`Payment amount mismatch. Expected: ${expectedAmountInCents}, Got: ${paymentIntent.amount}`);
      }
    }
    
    // Find the payment record
    const payment = await Payment.findOne({
      'providerData.paymentIntentId': paymentIntentId
    });
    
    if (!payment) {
      throw new Error('Payment record not found for this payment intent');
    }
    
    // Update payment status
    payment.status = 'completed';
    payment.transactionId = paymentIntentId;
    payment.providerData.rawResponse = paymentIntent;
    
    await payment.save();
    
    return payment;
  } catch (error) {
    throw new Error(`Stripe payment processing failed: ${error.message}`);
  }
}

// Also add this method for verifying provider payments
async verifyProviderPayment(provider, transactionId, amount = null, billingId = null) {
  try {
    let payment;
    
    switch (provider) {
      case 'mpesa':
        payment = await this.verifyMpesaPayment(transactionId);
        break;
      case 'mobilepay':
        payment = await this.verifyMobilePayPayment(transactionId);
        break;
      case 'airtel':
        payment = await this.verifyAirtelPayment(transactionId);
        break;
      case 'cash':
        // For cash payments, we need billingId and amount
        if (!billingId || amount === null) {
          throw new Error('Billing ID and amount are required for cash payments');
        }
        payment = await this.processCashPayment(billingId, amount, transactionId);
        break;
      // Add other providers as needed
      default:
        throw new Error(`Unsupported payment provider for verification: ${provider}`);
    }
    
    return payment;
  } catch (error) {
    throw new Error(`Provider payment verification failed: ${error.message}`);
  }
}

// Add this method to your PaymentService
async processCashPayment(billingId, amount, transactionId = null) {
  try {
    const billing = await Billing.findById(billingId);
    if (!billing) {
      throw new Error('Billing record not found');
    }

    // Validate amount
    const balanceDue = billing.getBalanceDue();
    const tolerance = 0.01;
    
    if (amount > balanceDue + tolerance) {
      throw new Error(
        `Payment of ${amount} ${billing.currency} ` +
        `exceeds balance due of ${balanceDue.toFixed(2)}`
      );
    }

    // Convert amount to storage format for cash payments
    const amountInStorageFormat = currencyUtils.toStorageFormat(amount, billing.currency);
    console.log('Cash payment - amount in display format:', amount);
    console.log('Cash payment - amount in storage format:', amountInStorageFormat);

    // Create cash payment record
    const paymentData = {
      billing: billingId,
      patient: billing.patient,
      invoiceNumber: billing.invoiceNumber,
      amount: amountInStorageFormat, // Store in storage format
      currency: billing.currency,
      method: 'cash',
      status: 'completed',
      transactionId: transactionId || `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      providerData: {
        provider: 'cash',
        processedAt: new Date()
      }
    };

    const payment = await this.createPayment(paymentData);
    return payment;
  } catch (error) {
    throw new Error(`Cash payment processing failed: ${error.message}`);
  }
};

// Add these verification methods for different providers
async verifyMpesaPayment(transactionId) {
  // Implement M-Pesa payment verification
  // This would typically involve calling the M-Pesa API
  const payment = await Payment.findOne({
    'providerData.checkoutRequestId': transactionId
  });
  
  if (payment) {
    // Simulate verification - in real implementation, call M-Pesa API
    payment.status = 'completed';
    await payment.save();
  }
  
  return payment;
}

async verifyMobilePayPayment(transactionId) {
  // Implement MobilePay payment verification
  const payment = await Payment.findOne({
    'providerData.paymentId': transactionId
  });
  
  if (payment) {
    // Simulate verification - in real implementation, call MobilePay API
    payment.status = 'completed';
    await payment.save();
  }
  
  return payment;
}

async verifyAirtelPayment(transactionId) {
  // Implement Airtel Money payment verification
  const payment = await Payment.findOne({
    'providerData.transactionId': transactionId
  });
  
  if (payment) {
    // Simulate verification - in real implementation, call Airtel API
    payment.status = 'completed';
    await payment.save();
  }
  
  return payment;
}
  
  // Create a new payment record
  async createPayment(paymentData) {
    try {
      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();
    
    // Check the raw value vs getter value
    const rawAmount = savedPayment.get('amount', null, { getters: false });
    
    return savedPayment;
    } catch (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  // Find payment by ID
  async findPaymentById(paymentId) {
    return await Payment.findById(paymentId)
      .populate('patient', 'name email phone')
      .populate('billing', 'invoiceNumber total currency');
  }

  // Find payment by transaction ID
  async findPaymentByTransactionId(transactionId) {
    return await Payment.findOne({ transactionId })
      .populate('patient', 'name email phone')
      .populate('billing', 'invoiceNumber total currency');
  }

  // Update payment status
  async updatePaymentStatus(paymentId, status, notes = '') {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.status = status;
    if (notes) {
      payment.notes = payment.notes ? `${payment.notes}\n${notes}` : notes;
    }

    return await payment.save();
  }

  // Process payment webhook
  async processWebhook(provider, webhookData) {
    try {
      let payment;
      
      switch (provider) {
        case 'stripe':
          payment = await this.processStripeWebhook(webhookData);
          break;
        case 'mobilepay':
          payment = await this.processMobilePayWebhook(webhookData);
          break;
        case 'mpesa':
          payment = await this.processMpesaWebhook(webhookData);
          break;
        // Add other providers here
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }

      return payment;
    } catch (error) {
      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }

  // Stripe webhook processing
  async processStripeWebhook(webhookData) {
    const { id, type, data } = webhookData;
    
    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      const payment = await Payment.findOne({
        'providerData.paymentIntentId': paymentIntent.id
      });

      if (payment) {
        payment.status = 'completed';
        payment.transactionId = paymentIntent.id;
        payment.providerData.rawResponse = paymentIntent;
        return await payment.save();
      }
    }
    
    return null;
  }

  // MobilePay webhook processing
  async processMobilePayWebhook(webhookData) {
    // Implement based on MobilePay webhook format
    const payment = await Payment.findOne({
      'providerData.paymentId': webhookData.payment_id
    });

    if (payment && webhookData.status === 'completed') {
      payment.status = 'completed';
      payment.providerData.rawResponse = webhookData;
      return await payment.save();
    }
    
    return null;
  }

  // M-Pesa webhook processing
  async processMpesaWebhook(webhookData) {
    const { Body: body } = webhookData;
    const stkCallback = body.stkCallback;
    
    if (stkCallback.ResultCode === 0) {
      // Payment successful
      const metadata = stkCallback.CallbackMetadata;
      const amountItem = metadata.Item.find(item => item.Name === 'Amount');
      const transactionIdItem = metadata.Item.find(item => item.Name === 'MpesaReceiptNumber');
      
      const payment = await Payment.findOne({
        'providerData.checkoutRequestId': stkCallback.CheckoutRequestID
      });

      if (payment) {
        payment.status = 'completed';
        payment.transactionId = transactionIdItem.Value;
        payment.providerData.receiptNumber = transactionIdItem.Value;
        payment.providerData.rawResponse = webhookData;
        return await payment.save();
      }
    }
    
    return null;
  }

  // Get payments by filters
  async getPayments(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = Payment.find(filters)
      .populate('patient', 'name email phone')
      .populate('billing', 'invoiceNumber total currency')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return await query.exec();
  }

  // Get payment statistics
  async getPaymentStats(timeframe = 'month') {
    const now = new Date();
    let startDate;

    switch (timeframe) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const payments = await Payment.find({
      createdAt: { $gte: startDate },
      status: 'completed'
    });

    const stats = {
      totalAmount: 0,
      transactionCount: payments.length,
      methods: {},
      dailyBreakdown: {}
    };

    payments.forEach(payment => {
      const amount = payment.amountDisplay;
      stats.totalAmount += amount;

      // Count by method
      if (!stats.methods[payment.method]) {
        stats.methods[payment.method] = { count: 0, amount: 0 };
      }
      stats.methods[payment.method].count += 1;
      stats.methods[payment.method].amount += amount;

      // Daily breakdown
      const dateStr = payment.createdAt.toISOString().split('T')[0];
      if (!stats.dailyBreakdown[dateStr]) {
        stats.dailyBreakdown[dateStr] = { count: 0, amount: 0 };
      }
      stats.dailyBreakdown[dateStr].count += 1;
      stats.dailyBreakdown[dateStr].amount += amount;
    });

    return stats;
  }
}

module.exports = new PaymentService();








// const Payment = require('../models/Payment');
// const Billing = require('../models/Billing');

// // Generate payment report
// exports.generatePaymentReport = async (startDate, endDate, method) => {
//   try {
//     const filter = {
//       createdAt: {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       },
//       status: 'completed'
//     };
    
//     if (method) {
//       filter.method = method;
//     }
    
//     const payments = await Payment.find(filter)
//       .populate('patientId', 'name')
//       .populate('billingId', 'invoiceNumber')
//       .sort({ createdAt: -1 });
    
//     // Calculate totals
//     const totals = {
//       card: 0,
//       cash: 0,
//       mobilepay: 0,
//       applepay: 0,
//       googlepay: 0,
//       bank_transfer: 0,
//       overall: 0
//     };
    
//     payments.forEach(payment => {
//       totals[payment.method] += payment.amount;
//       totals.overall += payment.amount;
//     });
    
//     return {
//       payments,
//       totals,
//       period: {
//         start: startDate,
//         end: endDate
//       }
//     };
//   } catch (error) {
//     throw new Error(`Report generation failed: ${error.message}`);
//   }
// };

// // Get payment statistics
// exports.getPaymentStatistics = async (period = 'month') => {
//   try {
//     let dateFilter = {};
//     const now = new Date();
    
//     switch (period) {
//       case 'day':
//         dateFilter = {
//           createdAt: {
//             $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
//             $lte: now
//           }
//         };
//         break;
//       case 'week':
//         const weekStart = new Date(now);
//         weekStart.setDate(now.getDate() - now.getDay());
//         dateFilter = {
//           createdAt: {
//             $gte: weekStart,
//             $lte: now
//           }
//         };
//         break;
//       case 'month':
//         dateFilter = {
//           createdAt: {
//             $gte: new Date(now.getFullYear(), now.getMonth(), 1),
//             $lte: now
//           }
//         };
//         break;
//       default:
//         dateFilter = {
//           createdAt: {
//             $gte: new Date(now.getFullYear(), now.getMonth(), 1),
//             $lte: now
//           }
//         };
//     }
    
//     const payments = await Payment.find({
//       ...dateFilter,
//       status: 'completed'
//     });
    
//     // Calculate statistics
//     const stats = {
//       totalAmount: 0,
//       transactionCount: payments.length,
//       methods: {
//         card: { count: 0, amount: 0 },
//         cash: { count: 0, amount: 0 },
//         mobilepay: { count: 0, amount: 0 },
//         applepay: { count: 0, amount: 0 },
//         googlepay: { count: 0, amount: 0 },
//         bank_transfer: { count: 0, amount: 0 }
//       }
//     };
    
//     payments.forEach(payment => {
//       stats.totalAmount += payment.amount;
//       stats.methods[payment.method].count += 1;
//       stats.methods[payment.method].amount += payment.amount;
//     });
    
//     // Calculate averages
//     stats.averageTransaction = stats.transactionCount > 0 
//       ? stats.totalAmount / stats.transactionCount 
//       : 0;
    
//     return stats;
//   } catch (error) {
//     throw new Error(`Statistics generation failed: ${error.message}`);
//   }
// };