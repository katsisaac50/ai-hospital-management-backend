// cron/paymentCleanupJob.js
const cron = require('node-cron');
const PendingPaymentService = require('../services/pendingPaymentService');
const NotificationService = require('../services/notificationService');

// Run every hour to cleanup expired payments
cron.schedule('0 * * * *', async () => {
  console.log('Running payment cleanup job...');
  try {
    const result = await PendingPaymentService.cleanupExpiredPayments();
    console.log(`Payment cleanup completed: ${result.succeeded} succeeded, ${result.failed} failed`);
  } catch (error) {
    console.error('Payment cleanup job failed:', error);
  }
});

// Run every 15 minutes to send reminders
cron.schedule('*/15 * * * *', async () => {
  console.log('Running payment reminder job...');
  try {
    // Get payments expiring in the next 30 minutes
    const soonToExpire = await PendingPaymentService.getPendingPayments({
      expirationTime: { 
        $lte: new Date(Date.now() + 30 * 60 * 1000),
        $gt: new Date() 
      }
    });
    
    for (const payment of soonToExpire) {
      await NotificationService.sendPaymentReminder(payment);
    }
    
    console.log(`Sent reminders for ${soonToExpire.length} payments`);
  } catch (error) {
    console.error('Payment reminder job failed:', error);
  }
});

module.exports = { cron };