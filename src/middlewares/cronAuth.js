import { config } from "../config/env.js";

export function cronAuth(req, res, next) {
    const authHeader = req.headers["authorization"] || "";
    const cronSecretHeader = req.headers["x-cron-secret"] || "";
    const querySecret = req.query.secret || "";

    const secretProvided =
        authHeader.replace("Bearer ", "").trim() ||
        cronSecretHeader ||
        querySecret;

    const isDev = (process.env.NODE_ENV || config.nodeEnv) === "development";

    // Allow unauthenticated calls only in development mode if no secret is provided
    if (isDev && !secretProvided) {
        return next();
    }

    if (secretProvided === config.cronSecret) {
        return next();
    }

    return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing CRON_SECRET"
    });
}
