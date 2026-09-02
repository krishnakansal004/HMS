import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer from 'nodemailer';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const notificationWorker = new Worker('notifications', async (job) => {
  // Your DoctorService dispatches job.name === "email"
  if (job.name === 'email') {
    const { to, subject, html, extra } = job.data;
    
    await transporter.sendMail({
      from: `"Hospital Admin" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
      attachments: extra?.attachments || []
    });
    
    console.log(`[BullMQ] Email successfully delivered to ${to}`);
  } else {
    console.warn(`[BullMQ] Unknown job type: ${job.name}`);
  }
}, { connection: redisConnection });

notificationWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed:`, err.message);
});