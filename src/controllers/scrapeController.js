import { db } from "../services/supabase.js";
import { scrapeProduct, scrapeAllActiveProducts } from "../scraper/index.js";
import { logger } from "../utils/logger.js";

let isScrapeAllRunning = false;

export const scrapeController = {
    /**
     * Trigger scheduled 2-hour cron scrape across ALL active products (Section 24 & 32)
     */
    async triggerAllScrapes(req, res, next) {
        try {
            if (isScrapeAllRunning) {
                logger.warn("[Cron Webhook] Attempted to start scrape-all while job is already in progress.");
                return res.status(409).json({
                    success: false,
                    error: {
                        type: "CONFLICT",
                        message: "A full batch scrape job is already in progress. Please wait for completion."
                    }
                });
            }

            const activeProducts = await db.getTrackedProducts(true);

            if (activeProducts.length === 0) {
                return res.json({
                    success: true,
                    message: "No active tracked products found to scrape.",
                    processedCount: 0
                });
            }

            isScrapeAllRunning = true;
            logger.info(`[Cron Webhook] Scheduled/Manual trigger initiated for ${activeProducts.length} active products`);

            // Respond quickly to cron service, execute batch scrape asynchronously
            res.json({
                success: true,
                message: `Batch scrape job initiated for ${activeProducts.length} active products.`,
                productCount: activeProducts.length,
                productIds: activeProducts.map(p => p.store_product_id)
            });

            const isHeaded = req.query.headed !== undefined ? req.query.headed === "true" : (req.body?.headed !== undefined ? Boolean(req.body.headed) : undefined);

            // Execute batch scrape with bounded concurrency worker pool
            try {
                await scrapeAllActiveProducts({ isHeaded });
            } catch (batchErr) {
                logger.error("[Cron Webhook] Batch scrape encountered error", batchErr);
            } finally {
                isScrapeAllRunning = false;
                logger.info("[Cron Webhook] Batch scrape job flag released.");
            }
        } catch (err) {
            isScrapeAllRunning = false;
            next(err);
        }
    },

    /**
     * Internal endpoint for scraping a single product by store product ID (Section 24)
     */
    async triggerSingleInternalScrape(req, res, next) {
        try {
            const { productId } = req.params;
            const isHeaded = req.query.headed !== undefined ? req.query.headed === "true" : undefined;

            const product = await db.getTrackedProductByStoreId(productId);
            const trackedProductId = product ? product.id : null;

            const result = await scrapeProduct(productId, {
                trackedProductId,
                ...(isHeaded !== undefined ? { isHeaded } : {})
            });

            if (result.success) {
                res.json({
                    success: true,
                    data: result
                });
            } else {
                res.status(502).json({
                    success: false,
                    error: result.error || { type: "STORE_UI_FAILURE", message: "Scrape failed after retries" },
                    logs: result.logs
                });
            }
        } catch (err) {
            next(err);
        }
    }
};
