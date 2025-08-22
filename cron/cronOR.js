const cron = require("node-cron");
const OperatingRoom = require("../models/operatingRoom.model");
const Payment = require("../models/payment.model");
const CronLog = require("../models/cronLog.model");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper function to log cron job results
const logCronJob = async (jobName, success, details = '', error = null) => {
  try {
    await CronLog.create({
      jobName,
      runAt: new Date(),
      success,
      details,
      error: error ? error.message : null
    });
  } catch (logError) {
    console.error(`❌ Failed to log cron job ${jobName}:`, logError);
  }
};

// Operating Room Auto-Release
const startORAutoReleaseCron = () => {
  cron.schedule("* * * * *", async () => {
    const jobName = "or-auto-release";
    console.log("⏱️ Running OR auto-release check...");

    try {
      const now = new Date();
      const expiredORs = await OperatingRoom.find({
        expectedRelease: { $lt: now },
        isAvailable: false,
        status: "occupied",
      });

      let releasedCount = 0;
      
      for (const or of expiredORs) {
        try {
          console.log(`🔓 Releasing OR: ${or.roomNumber}`);

          or.history.push({
            patient: or.currentPatient,
            doctor: or.assignedDoctor,
            surgeryType: or.notes || "Unspecified",
            startedAt: or.occupiedSince,
            endedAt: or.expectedRelease,
            notes: "Auto-released by cron",
          });

          or.isAvailable = true;
          or.status = "cleaning";
          or.currentPatient = null;
          or.assignedDoctor = null;
          or.occupiedSince = null;
          or.expectedRelease = null;

          await or.save();
          releasedCount++;
        } catch (orError) {
          console.error(`❌ Failed to release OR ${or.roomNumber}:`, orError);
          await logCronJob(jobName, false, `Failed to release OR ${or.roomNumber}`, orError);
        }
      }

      console.log(`✅ Released ${releasedCount} OR(s).`);
      await logCronJob(jobName, true, `Released ${releasedCount} OR(s)`);
    } catch (error) {
      console.error("❌ OR auto-release cron failed:", error);
      await logCronJob(jobName, false, "Job failed", error);
    }
  });
};

// Cleaning to Available Status Transition
const cleaningToAvailableCron = () => {
  cron.schedule("*/5 * * * *", async () => { // Run every 5 minutes
    const jobName = "or-cleaning-to-available";
    console.log("🧽 Checking cleaning ORs...");

    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const cleaningORs = await OperatingRoom.find({
        status: "cleaning",
        lastCleanedAt: { $lt: thirtyMinsAgo },
      });

      let freedCount = 0;
      
      for (const or of cleaningORs) {
        try {
          console.log(`✅ Marking OR ${or.roomNumber} as available`);
          or.status = "available";
          or.isAvailable = true;
          or.lastCleanedAt = new Date();
          await or.save();
          freedCount++;
        } catch (orError) {
          console.error(`❌ Failed to update OR ${or.roomNumber}:`, orError);
          await logCronJob(jobName, false, `Failed to update OR ${or.roomNumber}`, orError);
        }
      }

      console.log(`🧽 Cleaning check complete. Freed ${freedCount} OR(s).`);
      await logCronJob(jobName, true, `Freed ${freedCount} OR(s)`);
    } catch (error) {
      console.error("❌ OR cleaning cron failed:", error);
      await logCronJob(jobName, false, "Job failed", error);
    }
  });
};

// Payment Reconciliation Job
const paymentReconciliationCron = () => {
  cron.schedule('0 2 * * *', async () => { // Daily at 2 AM
    const jobName = "payment-reconciliation";
    console.log("💰 Running payment reconciliation...");

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingPayments = await Payment.find({
        status: 'processing',
        createdAt: { $lt: twentyFourHoursAgo }
      });

      let processedCount = 0;
      let failedCount = 0;
      
      for (const payment of pendingPayments) {
        try {
          console.log(`🔍 Checking payment status for ${payment.transactionId}`);
          
          // Check with Stripe API
          const paymentIntent = await stripe.paymentIntents.retrieve(payment.transactionId);
          
          if (paymentIntent.status === 'succeeded') {
            payment.status = 'completed';
            await payment.save();
            
            // Update associated billing record
            if (payment.billing) {
              const billing = await Billing.findById(payment.billing);
              if (billing) {
                await billing.updateBalance();
              }
            }
            
            processedCount++;
          } else if (['canceled', 'failed'].includes(paymentIntent.status)) {
            payment.status = 'failed';
            await payment.save();
            processedCount++;
          }
        } catch (paymentError) {
          console.error(`❌ Failed to reconcile payment ${payment._id}:`, paymentError);
          failedCount++;
        }
      }

      console.log(`💰 Reconciled ${processedCount} payments (${failedCount} failed)`);
      await logCronJob(jobName, true, `Reconciled ${processedCount} payments (${failedCount} failed)`);
    } catch (error) {
      console.error("❌ Payment reconciliation cron failed:", error);
      await logCronJob(jobName, false, "Job failed", error);
    }
  });
};

module.exports = { 
  startORAutoReleaseCron, 
  cleaningToAvailableCron,
  paymentReconciliationCron
};