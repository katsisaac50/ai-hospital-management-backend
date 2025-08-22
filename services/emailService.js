const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,  // e.g., "smtp.gmail.com"
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for port 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendLabTestCompletionEmail({ to, patientName, testType, labNumber, completedDate }) {
  const mailOptions = {
    from: `"Hospital Lab" <${process.env.SMTP_USER}>`,
    to,
    subject: `Lab Test Completed - ${patientName}`,
    html: `
      <h2>Lab Test Completed</h2>
      <p><b>Patient:</b> ${patientName}</p>
      <p><b>Test Type:</b> ${testType}</p>
      <p><b>Lab Record #:</b> ${labNumber}</p>
      <p><b>Completed On:</b> ${new Date(completedDate).toLocaleString()}</p>
      <br>
      <p>Please log in to the hospital system to view full results.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendLabTestCompletionEmail };
