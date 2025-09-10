// services/pendingPaymentService.js
const Payment = require('../models/payment.model');
const Billing = require('../models/billing.model');
const NotificationService = require('./notificationService');

class PendingPaymentService {
  
  // Get all pending payments
  async getPendingPayments(filters = {}) {
    const query = {
      status: 'pending',
      expirationTime: { $gt: new Date() }, // Not expired
      ...filters
    };
    
    return await Payment.find(query)
      .populate('patient', 'name email phone')
      .populate('billing', 'invoiceNumber total currency')
      .sort({ createdAt: -1 });
  }
  
  // Get expired payments
  async getExpiredPayments() {
    return await Payment.find({
      status: 'pending',
      expirationTime: { $lte: new Date() }
    })
    .populate('patient', 'name email phone')
    .populate('billing', 'invoiceNumber total currency');
  }
  
  // Expire a payment
  async expirePayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    payment.status = 'failed';
    payment.notes = payment.notes ? `${payment.notes}\nPayment expired at ${new Date().toISOString()}` 
                                  : `Payment expired at ${new Date().toISOString()}`;
    
    await payment.save();
    
    // Notify user about expired payment
    await NotificationService.sendPaymentExpiredNotification(payment);
    
    return payment;
  }
  
  // Retry a payment
  async retryPayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (!payment.canRetry) {
      throw new Error('Payment cannot be retried');
    }
    
    payment.retryCount += 1;
    payment.lastRetryAt = new Date();
    
    // Extend expiration time on retry
    payment.expirationTime = new Date(Date.now() + 30 * 60 * 1000);
    
    await payment.save();
    
    // Generate new payment data if needed (e.g., new payment link)
    const retryData = await this.generateRetryData(payment);
    
    return {
      payment,
      retryData
    };
  }
  
  // Generate retry data for different payment methods
  async generateRetryData(payment) {
    switch (payment.method) {
      case 'card':
        return await this.generateCardRetryData(payment);
      case 'mobilepay':
        return await this.generateMobilePayRetryData(payment);
      case 'mpesa':
        return await this.generateMpesaRetryData(payment);
      default:
        return {};
    }
  }
  
  async generateCardRetryData(payment) {
    // For card payments, create a new payment intent
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const billing = await Billing.findById(payment.billing);
    const amount = payment.amount; // Already in storage format
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: payment.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        billingId: payment.billing.toString(),
        patientId: payment.patient.toString(),
        invoiceNumber: billing.invoiceNumber,
        isRetry: 'true',
        originalPaymentId: payment._id.toString()
      }
    });
    
    // Update payment with new intent data
    payment.providerData.paymentIntentId = paymentIntent.id;
    payment.providerData.clientSecret = paymentIntent.client_secret;
    await payment.save();
    
    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  }
  
  // Clean up expired payments (to be run periodically)
  async cleanupExpiredPayments() {
    const expiredPayments = await this.getExpiredPayments();
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };
    
    for (const payment of expiredPayments) {
      try {
        await this.expirePayment(payment._id);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          paymentId: payment._id,
          error: error.message
        });
      }
      results.processed++;
    }
    
    return results;
  }
  
  // Get payment status
  async getPaymentStatus(paymentId) {
    const payment = await Payment.findById(paymentId)
      .populate('patient', 'name email phone')
      .populate('billing', 'invoiceNumber total currency');
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    const statusInfo = {
      status: payment.status,
      isExpired: payment.isExpired,
      canRetry: payment.canRetry,
      retryCount: payment.retryCount,
      maxRetries: payment.maxRetries,
      expirationTime: payment.expirationTime,
      timeRemaining: Math.max(0, payment.expirationTime - new Date())
    };
    
    return {
      payment,
      statusInfo
    };
  }
  
  // Cancel a pending payment
  async cancelPayment(paymentId, reason = 'Cancelled by user') {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    if (payment.status !== 'pending') {
      throw new Error('Only pending payments can be cancelled');
    }
    
    payment.status = 'failed';
    payment.notes = payment.notes ? `${payment.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
    
    await payment.save();
    
    // Notify user about cancellation
    await NotificationService.sendPaymentCancelledNotification(payment, reason);
    
    return payment;
  }
}

module.exports = new PendingPaymentService();