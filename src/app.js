import express from "express";
import cors from "cors";
import { requestLogger } from "./middlewares/requestLogger.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import productRoutes from "./routes/productRoutes.js";
import internalRoutes from "./routes/internalRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import scrapeRoutes from "./routes/scrapeRoutes.js";

const app = express();

// Core Middlewares
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health Check Endpoint (Section 23)
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "ine-price-tracker-backend",
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/internal", internalRoutes);

// Backward Compatibility Aliases
app.use("/api/tracking", trackingRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/scrape", scrapeRoutes);

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            type: "NOT_FOUND",
            message: `Route not found: ${req.method} ${req.originalUrl}`
        }
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
