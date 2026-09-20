import app from "./app.js";
import { config, validateEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { closeSharedBrowser } from "./scraper/browser.js";

// Validate env vars
validateEnv();

const server = app.listen(config.port, () => {
    logger.info(`==================================================`);
    logger.info(`   INE Price Tracker Backend API is Running!`);
    logger.info(`   Environment: ${config.nodeEnv}`);
    logger.info(`   Listening on Port: ${config.port}`);
    logger.info(`   Mock Store URL: ${config.mockStoreUrl}`);
    logger.info(`==================================================`);
});

// Graceful Shutdown (Section 46)
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down HTTP server gracefully...`);
    await closeSharedBrowser();
    server.close(() => {
        logger.info("HTTP server closed. Exiting process.");
        process.exit(0);
    });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

