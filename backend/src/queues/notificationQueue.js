import { Queue, Worker } from "bullmq";
import { getRedisConnectionOptions } from "./connection.js";
import {
  sendEmail,
  sendSMS,
  sendWhatsApp,
  sendWhatsAppTemplate,
} from "../utils/notifyDirect.js";

const connection = getRedisConnectionOptions();

export const notificationQueue = new Queue("notificationQueue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

export async function addNotificationJob(type, data) {
  return await notificationQueue.add(type, data);
}

// Start Worker
const worker = new Worker(
  "notificationQueue",
  async (job) => {
    const { name, data } = job;
    console.log(
      `[Worker:notificationQueue] Processing job ${job.id} of type ${name}`,
    );

    if (name === "email") {
      const { to, subject, html, extra } = data;
      const res = await sendEmail(to, subject, html, extra);
      if (!res.ok) {
        throw new Error(`Email sending failed: ${res.error}`);
      }
    } else if (name === "sms") {
      const { to, body } = data;
      await sendSMS(to, body);
    } else if (name === "whatsapp") {
      const { to, body } = data;
      await sendWhatsApp(to, body);
    } else if (name === "whatsappTemplate") {
      const { to, contentSid, variables } = data;
      await sendWhatsAppTemplate(to, contentSid, variables);
    }
  },
  { connection },
);

worker.on("failed", (job, err) => {
  console.error(
    `[Worker:notificationQueue] Job ${job?.id} failed:`,
    err.message,
  );
});

worker.on("completed", (job) => {
  console.log(
    `[Worker:notificationQueue] Job ${job.id} completed successfully`,
  );
});
