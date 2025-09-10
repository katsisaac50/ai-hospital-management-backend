const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = async (amount, email, description) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      receipt_email: email,
      description: description,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return paymentIntent;
  } catch (error) {
    throw new Error(`Stripe error: ${error.message}`);
  }
};

exports.verifyPayment = async (paymentIntentId, expectedAmount) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Verify amount matches
    if (paymentIntent.amount !== Math.round(expectedAmount * 100)) {
      throw new Error('Payment amount mismatch');
    }
    
    return paymentIntent;
  } catch (error) {
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

exports.createRefund = async (paymentIntentId, amount) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
    });
    
    return refund;
  } catch (error) {
    throw new Error(`Refund failed: ${error.message}`);
  }
};