import { mockStoreApi } from "../services/mockStoreApi.js";
import { db } from "../services/supabase.js";
import { scrapeProduct } from "../scraper/index.js";
import { validateIneUrl } from "../scraper/validator.js";
import { logger } from "../utils/logger.js";

export const productController = {
    /**
     * Search products on INE mock store catalog
     */
    async search(req, res, next) {
        try {
            const query = req.query.q || "";
            const results = await mockStoreApi.searchProducts(query);
            res.json({
                success: true,
                query,
                count: results.length,
                data: results
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Get store details for a single product by store product ID
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const product = await mockStoreApi.getProductDetails(id);
            res.json({
                success: true,
                data: product
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Get all active tracked products with their latest price & stock
     */
    async getTracked(req, res, next) {
        try {
            const products = await db.getTrackedProducts(true);

            // Enrich with price & stock observations scoped to tracking_started_at
            const enriched = await Promise.all(
                products.map(async (p) => {
                    const trackingStart = p.tracking_started_at || p.created_at;
                    const history = await db.getPriceHistory(p.id, 100, trackingStart);
                    const latest = history.length > 0 ? history[0] : null;
                    const previous = history.length > 1 ? history[1] : (history.length > 0 ? history[0] : null);
                    const baseline = history.length > 0 ? history[history.length - 1] : null;

                    const validPrices = history.map(h => Number(h.price)).filter(val => !isNaN(val) && val !== null);
                    const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;
                    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
                    const avgPrice = validPrices.length > 0 ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : null;

                    return {
                        ...p,
                        tracking_started_at: trackingStart,
                        current_price: latest ? latest.price : null,
                        previous_price: previous ? previous.price : null,
                        baseline_price: baseline ? baseline.price : null,
                        current_stock: latest ? latest.stock : null,
                        mrp: latest ? latest.mrp : null,
                        currency: latest ? latest.currency : "INR",
                        highest_price: highestPrice,
                        lowest_price: lowestPrice,
                        average_price: avgPrice,
                        observations_count: validPrices.length,
                        last_scraped_at: p.last_scraped_at || (latest ? latest.scraped_at : null)
                    };
                })
            );

            res.json({
                success: true,
                count: enriched.length,
                data: enriched
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Add a product to the tracking list (Section 26)
     */
    async trackProduct(req, res, next) {
        try {
            const { storeProductId, store_product_id, name, sku, url, imageUrl, image_url } = req.body;
            const targetStoreProductId = String(storeProductId || store_product_id || "");

            if (!targetStoreProductId) {
                return res.status(400).json({
                    success: false,
                    error: { type: "VALIDATION_ERROR", message: "storeProductId (or store_product_id) is required" }
                });
            }

            // Check if already tracked
            const existing = await db.getTrackedProductByStoreId(targetStoreProductId);
            const isHeaded = req.query.headed !== undefined ? req.query.headed === "true" : undefined;

            if (existing) {
                // If product already tracked, trigger fresh scrape on re-add
                scrapeProduct(targetStoreProductId, {
                    trackedProductId: existing.id,
                    ...(isHeaded !== undefined ? { isHeaded } : {})
                }).catch(err => logger.error(`Re-scrape error for existing product ${targetStoreProductId}`, err));

                return res.json({
                    success: true,
                    message: "Product is already tracked. Triggered fresh scrape.",
                    data: existing
                });
            }

            // Fetch details if name or url is missing
            let details = {
                name: name || "",
                sku: sku || "",
                url: url || "",
                imageUrl: imageUrl || image_url || ""
            };

            if (!details.name || !details.url) {
                const fetched = await mockStoreApi.getProductDetails(targetStoreProductId);
                if (!details.name) details.name = fetched.name;
                if (!details.sku) details.sku = fetched.sku;
                if (!details.url) details.url = fetched.url;
                if (!details.imageUrl) details.imageUrl = fetched.image_url;
            }

            // Validate that URL belongs strictly to INE mock store (Section 26 & 40)
            validateIneUrl(details.url);

            const trackedProduct = await db.addTrackedProduct({
                store_product_id: targetStoreProductId,
                name: details.name || `Product #${targetStoreProductId}`,
                sku: details.sku || "",
                url: details.url,
                image_url: details.imageUrl || "",
                is_active: true
            });

            // Trigger background initial scrape asynchronously
            scrapeProduct(targetStoreProductId, {
                trackedProductId: trackedProduct.id,
                ...(isHeaded !== undefined ? { isHeaded } : {})
            }).catch(err => logger.error(`Initial background scrape error for product ${targetStoreProductId}`, err));

            res.status(201).json({
                success: true,
                message: "Product added to tracking list. Initial scrape initiated.",
                data: trackedProduct
            });
        } catch (err) {
            if (err.name === "ScraperError" || err.type === "VALIDATION_ERROR") {
                return res.status(400).json({
                    success: false,
                    error: { type: "VALIDATION_ERROR", message: err.message }
                });
            }
            next(err);
        }
    },

    /**
     * Stop tracking a product
     */
    async untrackProduct(req, res, next) {
        try {
            const { id } = req.params;
            await db.removeTrackedProduct(id);
            res.json({
                success: true,
                message: "Product untracked successfully"
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Get price history for a tracked product (Section 28)
     */
    async getHistory(req, res, next) {
        try {
            const { id } = req.params;
            const limit = req.query.limit ? Number(req.query.limit) : 100;

            let product = await db.getTrackedProductById(id).catch(() => null);
            if (!product) {
                product = await db.getTrackedProductByStoreId(id);
            }

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: { type: "PRODUCT_NOT_FOUND", message: "Tracked product not found" }
                });
            }

            const history = await db.getPriceHistory(product.id, limit, product.tracking_started_at || product.created_at);

            res.json({
                success: true,
                productId: product.id,
                storeProductId: product.store_product_id,
                trackingStartedAt: product.tracking_started_at || product.created_at,
                count: history.length,
                data: history
            });
        } catch (err) {
            next(err);
        }
    },

    /**
     * Get scrape logs for a tracked product (Section 29)
     */
    async getLogs(req, res, next) {
        try {
            const { id } = req.params;
            const limit = req.query.limit ? Number(req.query.limit) : 100;

            let product = await db.getTrackedProductById(id).catch(() => null);
            if (!product) {
                product = await db.getTrackedProductByStoreId(id);
            }

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: { type: "PRODUCT_NOT_FOUND", message: "Tracked product not found" }
                });
            }

            const logs = await db.getScrapeLogs(product.id, limit, product.tracking_started_at || product.created_at);

            res.json({
                success: true,
                productId: product.id,
                storeProductId: product.store_product_id,
                trackingStartedAt: product.tracking_started_at || product.created_at,
                count: logs.length,
                data: logs
            });
            } catch (err) {
            next(err);
        }
    },

    /**
     * Manual scrape trigger for a specific tracked product (Section 25)
     */
    async manualScrape(req, res, next) {
        try {
            const { id } = req.params;

            // Try to find by database UUID or store_product_id
            let product = null;
            try {
                product = await db.getTrackedProductById(id);
            } catch {
                product = await db.getTrackedProductByStoreId(id);
            }

            if (!product) {
                return res.status(404).json({
                    success: false,
                    productId: id,
                    error: { type: "PRODUCT_NOT_FOUND", message: "Tracked product not found" }
                });
            }

            if (!product.is_active) {
                return res.status(400).json({
                    success: false,
                    productId: product.id,
                    error: { type: "VALIDATION_ERROR", message: "Cannot scrape inactive product" }
                });
            }

            const isHeaded = req.query.headed !== undefined ? req.query.headed === "true" : undefined;
            const result = await scrapeProduct(product.store_product_id, {
                trackedProductId: product.id,
                ...(isHeaded !== undefined ? { isHeaded } : {})
            });

            if (result.success) {
                res.json({
                    success: true,
                    productId: product.id,
                    storeProductId: product.store_product_id,
                    price: result.price,
                    mrp: result.mrp,
                    stock: result.stock,
                    currency: result.currency,
                    scrapedAt: result.scrapedAt
                });
            } else {
                res.status(502).json({
                    success: false,
                    productId: product.id,
                    error: result.error || { type: "STORE_UI_FAILURE", message: "Scrape failed after retries" }
                });
            }
        } catch (err) {
            next(err);
        }
    }
};
