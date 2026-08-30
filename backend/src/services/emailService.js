import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export class EmailService {
  static async sendStaffCredentials(email, name, role, rawPassword, loginUrl) {
    const mailOptions = {
      from: `"Hospital Admin" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Your Hospital Management System Credentials',
      html: `
        <h3>Welcome, ${name}</h3>
        <p>Your account has been created with the role: <strong>${role}</strong>.</p>
        <p>Please log in using the credentials below:</p>
        <div style="background: #f4f4f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <span style="font-family: monospace; font-size: 16px;">${rawPassword}</span></p>
        </div>
        <p><a href="${loginUrl}" style="background: #0ea5e9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Log In to Your Account</a></p>
        <p style="color: #ef4444; font-size: 12px; margin-top: 20px;">You will be required to change this password upon your first login.</p>
      `,
    };
    return transporter.sendMail(mailOptions);
  }

  // Add more templates here later (e.g., sendAppointmentReminder)
}