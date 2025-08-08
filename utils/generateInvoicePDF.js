// utils/generateInvoicePDF.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = async (invoice, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text('Hospital Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
    doc.text(`Patient ID: ${invoice.patient.patientId}`);
    doc.text(`Patient Name: ${invoice.patient.name}`);
    doc.moveDown();

    doc.fontSize(14).text('Items:', { underline: true });

    invoice.items.forEach((item, idx) => {
      doc.text(
        `${idx + 1}. ${item.description} - ${item.quantity} x ${item.unitPrice} = ${item.amount}`
      );
    });

    doc.moveDown();
    doc.text(`Subtotal: $${invoice.subtotal}`);
    doc.text(`Tax: $${invoice.tax}`);
    doc.text(`Discount: $${invoice.discount}`);
    doc.text(`Total: $${invoice.total}`);
    doc.text(`Status: ${invoice.status}`);
    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
};

module.exports = generateInvoicePDF;
