// services/notificationService.js
const EmailSender = require('./emailSender');

class NotificationService {
  
  // Send payment expired notification
  static async sendPaymentExpiredNotification(payment) {
    try {
      const subject = `Payment Expired - Invoice ${payment.invoiceNumber}`;
      const text = `Your payment attempt for invoice ${payment.invoiceNumber} has expired. Please try again if you still wish to pay.`;
      
      // Get patient email from populated payment or fetch it
      const patientEmail = payment.patient.email || await this.getPatientEmail(payment.patient);
      
      if (patientEmail) {
        await EmailSender.send({
          to: patientEmail,
          subject,
          text,
          html: this.createPaymentHtmlTemplate(subject, text)
        });
      }
      
      // TODO: Add SMS, push notifications, etc.
      
    } catch (error) {
      console.error('Failed to send payment expired notification:', error);
    }
  }
  
  // Send payment cancelled notification
  static async sendPaymentCancelledNotification(payment, reason) {
    try {
      const subject = `Payment Cancelled - Invoice ${payment.invoiceNumber}`;
      const text = `Your payment for invoice ${payment.invoiceNumber} has been cancelled. Reason: ${reason}`;
      
      const patientEmail = payment.patient.email || await this.getPatientEmail(payment.patient);
      
      if (patientEmail) {
        await EmailSender.send({
          to: patientEmail,
          subject,
          text,
          html: this.createPaymentHtmlTemplate(subject, text)
        });
      }
      
    } catch (error) {
      console.error('Failed to send payment cancelled notification:', error);
    }
  }
  
  // Send payment reminder
  static async sendPaymentReminder(payment) {
    try {
      const subject = `Payment Reminder - Invoice ${payment.invoiceNumber}`;
      const text = `This is a reminder that your payment for invoice ${payment.invoiceNumber} is still pending. It will expire at ${payment.expirationTime}.`;
      
      const patientEmail = payment.patient.email || await this.getPatientEmail(payment.patient);
      
      if (patientEmail) {
        await EmailSender.send({
          to: patientEmail,
          subject,
          text,
          html: this.createPaymentHtmlTemplate(subject, text)
        });
      }
      
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
    }
  }
  
  // Helper method to get patient email
  static async getPatientEmail(patientId) {
    const Patient = require('../models/patient.model');
    const patient = await Patient.findById(patientId).select('email');
    return patient ? patient.email : null;
  }
  
  // HTML template for payment emails
  static createPaymentHtmlTemplate(subject, text) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>${text}</p>
        <p>If you have any questions, please contact our support team.</p>
        <br>
        <p>Best regards,<br>Healthcare Provider</p>
      </div>
    `;
  }
}

module.exports = NotificationService;