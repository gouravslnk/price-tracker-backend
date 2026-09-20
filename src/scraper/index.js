import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { db } from "../services/supabase.js";
import { getBrowserInstance, createFreshContext, closeContext } from "./browser.js";
import { validateIneUrl } from "./validator.js";
import { acceptCookies } from "./cookies.js";
import { navigateToProduct, hoverPriceArea, clickRevealButton } from "./product-page.js";
import { setupNetworkInterceptor } from "./network.js";
import { calculateBackoff, captureFailureScreenshot } from "./retry.js";
import { ScraperError, ErrorCategory } from "./errors.js";

/**
 * Scrape a single product using Playwright browser automation with 2-layer retry policy.
 * @param {string|number} storeProductId - Store product ID (e.g. "274")
 * @param {object} options - Options ({ trackedProductId, isHeaded, customBrowser })
 */
export async function scrapeProduct(storeProductId, options = {}) {
    const { trackedProductId = null, isHeaded = undefined, customBrowser = null } = options;
    const startTime = Date.now();
    const productIdStr = String(storeProductId);
    const targetUrl = `${config.mockStoreUrl}/product/${productIdStr}`;

    // Validate INE store URL
    validateIneUrl(targetUrl);

    const maxAttempts = config.maxScrapeAttempts || 4;
    const effectiveHeaded = isHeaded !== undefined ? isHeaded : (!config.headless);
    logger.info(`Starting Scraper for Store Product ID: ${productIdStr} (Max Attempts: ${maxAttempts}, Headed: ${effectiveHeaded})`);

    if (config.demoMode) {
        logger.info(`[${new Date().toISOString()}] DEMO_MODE: Starting timeline for Product ${productIdStr}`);
    }

    const attemptLogs = [];
    let success = false;
    let finalQuote = null;

    const browser = customBrowser || await getBrowserInstance({ isHeaded: effectiveHeaded });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const attemptStart = Date.now();
        logger.info(`--- Outer Attempt ${attempt}/${maxAttempts} for Product ${productIdStr} ---`);
        if (config.demoMode) {
            logger.info(`[${new Date().toISOString()}] Attempt ${attempt}: Opening fresh browser context`);
        }

        let context = null;
        let page = null;
        const stateHolder = { latestQuote: null, lastHttpStatus: null, lastError: null };

        try {
            // Fresh context for isolation and clean session on retry
            context = await createFreshContext(browser);
            page = await context.newPage();

            // Setup network response listener for challenge, session, and price API
            setupNetworkInterceptor(page, productIdStr, stateHolder);

            // 1. Navigate to product page
            await navigateToProduct(page, targetUrl);
            if (config.demoMode) logger.info(`[${new Date().toISOString()}] Product page loaded`);

            // 2. Accept cookies if present
            await acceptCookies(page);

            // 3. Hover price area (dwell time)
            await hoverPriceArea(page);
            if (config.demoMode) logger.info(`[${new Date().toISOString()}] Price area hovered`);

            // 4. Click REVEAL PRICE
            await clickRevealButton(page);
            if (config.demoMode) logger.info(`[${new Date().toISOString()}] REVEAL PRICE clicked`);

            // 5. Wait for network response / WASM attestation / store internal retries
            for (let waitStep = 0; waitStep < 14; waitStep++) {
                if (stateHolder.latestQuote) break;

                const currentBody = await page.innerText("body").catch(() => "");
                if (currentBody.includes("Couldn't load the price after 6 attempts") || currentBody.includes("unauthorized")) {
                    break;
                }

                await page.waitForTimeout(500);
            }

            if (stateHolder.latestQuote) {
                success = true;
                finalQuote = stateHolder.latestQuote;
                const durationMs = Date.now() - attemptStart;

                const logItem = {
                    tracked_product_id: trackedProductId,
                    attempt_number: attempt,
                    status: "SUCCESS",
                    http_status: 200,
                    error_message: null,
                    duration_ms: durationMs
                };
                attemptLogs.push(logItem);

                if (trackedProductId) {
                    await db.addScrapeLog(logItem);
                }

                if (config.demoMode) {
                    logger.info(`[${new Date().toISOString()}] SUCCESS: Decrypted Price ₹${finalQuote.price}, Stock ${finalQuote.stock}`);
                }

                await closeContext(context);
                break;
            }

            // Inspect page DOM for specific store status codes or store retries
            const pageContent = await page.innerText("body").catch(() => "");
            let currentHttpStatus = stateHolder.lastHttpStatus || 500;
            let domMessage = stateHolder.lastError || "Store returned no valid price payload";

            if (pageContent.includes("503")) { domMessage = "Store responded with 'upstream 503'"; currentHttpStatus = 503; }
            else if (pageContent.includes("429")) { domMessage = "Store responded with 'upstream 429'"; currentHttpStatus = 429; }
            else if (pageContent.includes("unauthorized") || pageContent.includes("401")) { domMessage = "Store responded with 'unauthorized 401'"; currentHttpStatus = 401; }
            else if (pageContent.includes("Couldn't load the price after 6 attempts")) { domMessage = "Store retries exhausted (6/6 attempts failed)"; }

            const isFinalAttempt = attempt === maxAttempts;
            const statusStr = isFinalAttempt ? "FAILED" : "RETRY";
            const durationMs = Date.now() - attemptStart;

            const logItem = {
                tracked_product_id: trackedProductId,
                attempt_number: attempt,
                status: statusStr,
                http_status: currentHttpStatus,
                error_message: domMessage,
                duration_ms: durationMs
            };
            attemptLogs.push(logItem);

            if (trackedProductId) {
                await db.addScrapeLog(logItem);
            }

            // Capture screenshot on attempt failure if configured
            await captureFailureScreenshot(page, productIdStr, attempt);
            await closeContext(context);

            if (!isFinalAttempt) {
                const backoffMs = calculateBackoff(attempt);
                logger.info(`Attempt ${attempt} outcome: ${domMessage}. Backoff delay: ${Math.round(backoffMs)}ms`);
                if (config.demoMode) logger.info(`[${new Date().toISOString()}] Waiting ${Math.round(backoffMs)}ms before next attempt`);
                await new Promise(res => setTimeout(res, backoffMs));
            }
        } catch (attemptErr) {
            logger.warn(`Attempt ${attempt} encountered error: ${attemptErr.message}`);
            if (page) {
                await captureFailureScreenshot(page, productIdStr, attempt).catch(() => {});
            }
            await closeContext(context);

            const isFinalAttempt = attempt === maxAttempts;
            const durationMs = Date.now() - attemptStart;
            const httpStatus = attemptErr instanceof ScraperError ? (attemptErr.httpStatus || 500) : 500;

            const logItem = {
                tracked_product_id: trackedProductId,
                attempt_number: attempt,
                status: isFinalAttempt ? "FAILED" : "RETRY",
                http_status: httpStatus,
                error_message: attemptErr.message,
                duration_ms: durationMs
            };
            attemptLogs.push(logItem);

            if (trackedProductId) {
                await db.addScrapeLog(logItem);
            }

            if (!isFinalAttempt) {
                const backoffMs = calculateBackoff(attempt);
                await new Promise(res => setTimeout(res, backoffMs));
            }
        }
    }

    // Only close browser if we launched an ad-hoc local browser instance
    if (!customBrowser) {
        // Shared browser can be kept alive or closed per batch
    }

    const totalDurationMs = Date.now() - startTime;

    if (success && finalQuote) {
        logger.info(`Scrape Completed Successfully for Product ${productIdStr} in ${totalDurationMs}ms`);

        // Insert into price_history and update last_scraped_at ONLY ON SUCCESS
        if (trackedProductId) {
            await db.addPriceHistory(
                trackedProductId,
                finalQuote.price,
                finalQuote.stock,
                finalQuote.mrp,
                finalQuote.currency
            );
        }

        return {
            success: true,
            storeProductId: productIdStr,
            price: finalQuote.price,
            mrp: finalQuote.mrp,
            stock: finalQuote.stock,
            currency: finalQuote.currency,
            seller: finalQuote.seller,
            rating: finalQuote.rating,
            ratingCount: finalQuote.ratingCount,
            deliveryDays: finalQuote.deliveryDays,
            durationMs: totalDurationMs,
            scrapedAt: new Date().toISOString(),
            logs: attemptLogs
        };
    } else {
        logger.error(`Scrape Failed for Product ${productIdStr} after ${maxAttempts} attempts`);
        return {
            success: false,
            storeProductId: productIdStr,
            durationMs: totalDurationMs,
            logs: attemptLogs,
            error: {
                type: ErrorCategory.STORE_UI_FAILURE,
                message: `Failed to reveal valid price payload after ${maxAttempts} attempts`
            }
        };
    }
}

/**
 * Run scraper for all active tracked products in sequential batches (Concurrency: 1 for Render Free-tier RAM optimization)
 * @param {object} options 
 */
export async function scrapeAllActiveProducts(options = {}) {
    const products = await db.getTrackedProducts(true);
    if (products.length === 0) {
        logger.info("[Batch Scraper] No active products found to scrape.");
        return { processedCount: 0, results: [] };
    }

    const concurrency = Math.max(1, config.scrapeConcurrency || 1);
    logger.info(`[Batch Scraper] Starting batch scrape for ${products.length} active products (Concurrency: ${concurrency} - sequential mode)`);

    const browser = await getBrowserInstance();
    const results = [];

    // Worker pool queue (processes 1 by 1 sequentially when concurrency=1)
    const queue = [...products];
    const workers = Array.from({ length: Math.min(concurrency, products.length) }, async (workerId) => {
        while (queue.length > 0) {
            const product = queue.shift();
            if (!product) break;

            try {
                logger.info(`[Batch Worker] Processing product ${product.store_product_id} (${product.name})`);
                const result = await scrapeProduct(product.store_product_id, {
                    trackedProductId: product.id,
                    customBrowser: browser
                });
                results.push({ productId: product.id, storeProductId: product.store_product_id, result });
            } catch (err) {
                logger.error(`[Batch Worker] Error processing product ${product.store_product_id}`, err);
                results.push({
                    productId: product.id,
                    storeProductId: product.store_product_id,
                    result: { success: false, error: err.message }
                });
            }

            // Brief 500ms delay between products to allow garbage collection & prevent CPU/RAM spikes on Render
            if (queue.length > 0) {
                await new Promise(res => setTimeout(res, 500));
            }
        }
    });

    await Promise.all(workers);
    logger.info(`[Batch Scraper] Completed batch scrape for ${products.length} products.`);

    return {
        processedCount: products.length,
        results
    };
}
