const Bull = require('bull');
const emailSender = require('./emailSender');
const logger = require('../utils/logger');

class EmailQueue {
  constructor() {
    this.queue = null;
  }

  async initialize() {
    if (this.queue || process.env.EMAIL_QUEUE_ENABLED === 'false') return;

    this.queue = new Bull('email', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    });

    this.queue.process(async (job) => {
      try {
        const result = await emailSender.sendDirectly(job.data);
        logger.info(`Email sent to ${job.data.to}`);
        return result;
      } catch (error) {
        logger.error(`Failed to send email to ${job.data.to}:`, error);
        throw error;
      }
    });
  }

  async addToQueue(mailOptions) {
    if (!this.queue) await this.initialize();
    return this.queue.add(mailOptions);
  }
}

module.exports = new EmailQueue();