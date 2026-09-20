import path from "node:path";
import fs from "node:fs/promises";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

/**
 * Compute exponential backoff delay with random jitter
 * @param {number} attempt - Current attempt number (1-indexed)
 * @param {number} baseDelayMs - Base delay in ms (default 1000)
 * @param {number} maxDelayMs - Maximum delay cap in ms (default 10000)
 */
export function calculateBackoff(attempt, baseDelayMs = 1000, maxDelayMs = 10000) {
    const exponential = Math.pow(2, attempt - 1) * baseDelayMs;
    const jitter = Math.random() * 500;
    return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Capture diagnostic screenshot on failure if enabled
 * @param {import('playwright').Page} page 
 * @param {string|number} storeProductId 
 * @param {number} attempt 
 */
export async function captureFailureScreenshot(page, storeProductId, attempt) {
    if (!config.screenshotOnFailure) return;

    try {
        const screenshotDir = path.resolve(process.cwd(), "screenshots");
        await fs.mkdir(screenshotDir, { recursive: true });

        const fileName = `product-${storeProductId}-attempt-${attempt}.png`;
        const filePath = path.join(screenshotDir, fileName);

        await page.screenshot({ path: filePath, fullPage: false, timeout: 5000 });
        logger.info(`[Diagnostic] Captured failure screenshot: ${filePath}`);
    } catch (err) {
        logger.warn(`[Diagnostic] Failed to capture failure screenshot: ${err.message}`);
    }
}
