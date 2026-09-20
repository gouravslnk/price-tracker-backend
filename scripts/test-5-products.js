import { mockStoreApi } from "../src/services/mockStoreApi.js";
import { scrapeProduct } from "../src/scraper/index.js";
import { logger } from "../src/utils/logger.js";
import { config } from "../src/config/env.js";
import { closeSharedBrowser } from "../src/scraper/browser.js";

async function test5RandomProducts() {
    logger.info("==================================================");
    logger.info("   TESTING BACKEND API: SCRAPING 5 RANDOM PRODUCTS");
    logger.info("==================================================");

    try {
        // 1. Fetch live products from INE catalog API (/api/catalog)
        logger.info("Fetching live catalog from INE mock store API (/api/catalog)...");
        const catalog = await mockStoreApi.searchProducts("");

        if (!catalog || catalog.length === 0) {
            logger.error("No products returned from live catalog API!");
            return;
        }

        logger.info(`Total products returned from live API: ${catalog.length}`);

        // 2. Pick 5 random products
        const shuffled = [...catalog].sort(() => 0.5 - Math.random());
        const selectedProducts = shuffled.slice(0, 5);

        logger.info(`Selected 5 random live products to scrape:`);
        for (let idx = 0; idx < selectedProducts.length; idx++) {
            const p = selectedProducts[idx];
            // Also test live single-product API (/api/product/:id)
            const details = await mockStoreApi.getProductDetails(p.store_product_id);
            logger.info(`   ${idx + 1}. [ID: ${details.store_product_id}] ${details.name} (SKU: ${details.sku})`);
            logger.info(`      Live API: ${config.mockStoreUrl}/api/product/${details.store_product_id}`);
        }
        logger.info("--------------------------------------------------");

        const summaryResults = [];

        // 3. Scrape each selected product using Playwright scraper
        for (let i = 0; i < selectedProducts.length; i++) {
            const product = selectedProducts[i];
            logger.info(`\n[${i + 1}/5] Scraping Product ID ${product.store_product_id}: "${product.name}"...`);

            const startTime = Date.now();
            const result = await scrapeProduct(product.store_product_id, {
                isHeaded: false
            });
            const durationMs = Date.now() - startTime;

            if (result.success) {
                logger.info(`✅ SUCCESS for Product ${product.store_product_id}!`);
                logger.info(`   Price   : ₹ ${result.price}`);
                logger.info(`   Stock   : ${result.stock} units`);
                logger.info(`   MRP     : ${result.mrp ? "₹ " + result.mrp : "N/A"}`);
                logger.info(`   Currency: ${result.currency}`);
                logger.info(`   Duration: ${durationMs} ms`);

                summaryResults.push({
                    id: product.store_product_id,
                    name: product.name,
                    status: "SUCCESS",
                    price: result.price,
                    stock: result.stock,
                    mrp: result.mrp,
                    currency: result.currency,
                    durationMs,
                    attempts: result.logs ? result.logs.length : 1
                });
            } else {
                logger.error(`❌ FAILED for Product ${product.store_product_id}!`);
                logger.error(`   Error   : ${JSON.stringify(result.error)}`);
                logger.error(`   Duration: ${durationMs} ms`);

                summaryResults.push({
                    id: product.store_product_id,
                    name: product.name,
                    status: "FAILED",
                    error: result.error,
                    durationMs,
                    attempts: result.logs ? result.logs.length : 0
                });
            }
        }

        // 4. Print final summary table
        logger.info("\n==================================================");
        logger.info("               FINAL SCRAPE SUMMARY REPORT         ");
        logger.info("==================================================");
        console.table(summaryResults.map(r => ({
            "Product ID": r.id,
            "Name": r.name.substring(0, 30),
            "Status": r.status,
            "Price": r.status === "SUCCESS" ? `₹${r.price}` : "N/A",
            "Stock": r.status === "SUCCESS" ? r.stock : "N/A",
            "Attempts": r.attempts,
            "Duration (s)": (r.durationMs / 1000).toFixed(2)
        })));

    } catch (err) {
        logger.error("Fatal error during 5-product test run", err);
    } finally {
        await closeSharedBrowser();
    }
}

test5RandomProducts();
