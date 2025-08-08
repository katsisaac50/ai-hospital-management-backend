const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const ErrorResponse = require('../utils/errorResponse');

class EmailSender {
  constructor() {
    this.transporter = null;
    this.templateCache = new Map();
  }

  async initialize() {
    if (this.transporter) return;

    if (process.env.NODE_ENV === 'development') {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.log('Dev email credentials:', testAccount.user, testAccount.pass);
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });
    }

    await this.transporter.verify();
  }

  async loadTemplate(templateName, data = {}) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    let html = await fs.readFile(templatePath, 'utf8');
    html = html.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || '');
    this.templateCache.set(templateName, html);
    return html;
  }

  sanitize(emailContent) {
    return sanitizeHtml(emailContent, {
      allowedTags: ['h1', 'h2', 'h3', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'br'],
      allowedAttributes: { 'a': ['href', 'target'] }
    });
  }

  validateAttachments(attachments) {
    if (!attachments) return [];
    
    const MAX_SIZE = 10 * 1024 * 1024;
    const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg', 'gif'];
    
    return attachments.map(attachment => {
      const ext = path.extname(attachment.filename).slice(1).toLowerCase();
      if (attachment.size > MAX_SIZE) throw new Error(`Attachment exceeds 10MB limit`);
      if (!allowedTypes.includes(ext)) throw new Error(`Attachment type .${ext} not allowed`);
      return attachment;
    });
  }

  async send(options) {
    try {
      if (!this.transporter) await this.initialize();

      // Validate inputs
      if (!options.to) throw new ErrorResponse('Recipient required', 400);
      if (!options.subject) throw new ErrorResponse('Subject required', 400);

      // Load template if specified
      let html = options.html;
      if (options.template) {
        html = await this.loadTemplate(options.template, options.templateData || {});
      }

      if (!options.text && !html) {
        throw new ErrorResponse('Email content required', 400);
      }

      // Prepare email
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: html ? this.sanitize(html) : undefined,
        attachments: this.validateAttachments(options.attachments)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${options.to}`);
      return info;

    } catch (error) {
      console.error('Email error:', error);
      throw error instanceof ErrorResponse ? error : new ErrorResponse('Failed to send email', 500);
    }
  }
}

// Export a singleton instance
module.exports = new EmailSender();