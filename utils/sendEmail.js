const nodemailer = require('nodemailer');
const ErrorResponse = require('../utils/errorResponse');

// Configure transporter based on environment
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD,
//   },
// });

async function createTestTransporter() {

let transporter

if (process.env.NODE_ENV === 'development') {
  const testAccount = await nodemailer.createTestAccount()
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  })
} else {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  })
}


// Test the transporter connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('Error verifying email transporter:', error);
  } else {
    console.log('Email transporter is ready to send messages');
  }
});
  return transporter;
}

/**
 * Send email with optional attachments
 * @param {Object} options - Email options
 * @param {string|Array} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Array of attachment objects
 * @returns {Promise}
 */
const sendEmail = async (options) => {
  try {
    // Validate required fields
    if (!options.to) {
      throw new ErrorResponse('Recipient email address is required', 400);
    }
    if (!options.subject) {
      throw new ErrorResponse('Email subject is required', 400);
    }
    if (!options.text && !options.html) {
      throw new ErrorResponse('Email body (text or html) is required', 400);
    }

    // Prepare email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Log email ID for reference (not exposed to client)
    console.log(`Email sent: ${info.messageId}`);

    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Handle specific nodemailer errors
    if (error.code === 'ECONNECTION') {
      throw new ErrorResponse('Could not connect to email server', 503);
    }
    if (error.code === 'EAUTH') {
      throw new ErrorResponse('Email authentication failed', 401);
    }

    // Re-throw if it's already an ErrorResponse
    if (error instanceof ErrorResponse) {
      throw error;
    }

    // Generic error for everything else
    throw new ErrorResponse('Failed to send email', 500);
  }
};

module.exports = sendEmail;