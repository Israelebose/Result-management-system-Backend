const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // you can change to another SMTP provider
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // your email password or app-specific password
  },
});

// Function to send OTP email
async function sendOtpEmail(to, otp) {
  try {
    const info = await transporter.sendMail({
      from: `"Student Management App" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Your OTP Code',
      html: `<p>Hello,</p>
             <p>Your OTP code is: <b>${otp}</b></p>
             <p>This code will expire in 5 minutes.</p>`,
    });

    console.log('OTP email sent:', info.messageId);
  } catch (err) {
    console.error('Error sending OTP email:', err);
  }
}

module.exports = sendOtpEmail;
