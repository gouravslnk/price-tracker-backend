const isProduction = process.env.NODE_ENV === "production";

export const logger = {
    info: (msg, data = "") => {
        console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data) : "");
    },
    warn: (msg, data = "") => {
        console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data) : "");
    },
    error: (msg, error = "") => {
        console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, error?.stack || error || "");
    },
    debug: (msg, data = "") => {
        if (!isProduction) {
            console.log(`[DEBUG] [${new Date().toISOString()}] ${msg}`, data ? JSON.stringify(data) : "");
        }
    }
};
