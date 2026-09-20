import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);

    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
}
