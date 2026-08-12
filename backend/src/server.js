import app from './app.js';
import { env } from './config/env.js';
import { db, connectDB, disconnectDB } from './config/db.js';
import { logger } from './config/logger.js';

const startServer = async () => {
  try {
    // 1. Establish database connection
    await connectDB();

    // 2. Start Express HTTP server
    const server = app.listen(env.port, () => {
      logger.info(`[SERVER] Hospital Management System running on port ${env.port} in [${env.nodeEnv}] mode.`);
    });

    // Graceful Shutdown handling
    const shutdown = async (signal) => {
      logger.warn(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        await disconnectDB();
        logger.info('[SERVER] Closed out remaining connections. Process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('[SERVER] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();