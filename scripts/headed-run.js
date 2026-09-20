import { scrapeProduct } from "../src/services/scraper.js";
import { logger } from "../src/utils/logger.js";

async function runHeadedDemo() {
    const args = process.argv.slice(2);
    const productIdArg = args.find(a => !a.startsWith("--")) || "274";

    logger.info(`==================================================`);
    logger.info(`   OBSERVABLE HEADED SCRAPER RUN DEMO`);
    logger.info(`   Target Product ID: ${productIdArg}`);
    logger.info(`   Browser Mode     : Headed (Visible Chromium UI)`);
    logger.info(`==================================================`);

    const result = await scrapeProduct(productIdArg, { isHeaded: true });

    if (result.success) {
        logger.info(`🎉 Headed Scrape Demo Completed Successfully!`);
        logger.info(`   Product ID: ${result.storeProductId}`);
        logger.info(`   Price     : ₹ ${result.price}`);
        logger.info(`   Stock     : ${result.stock} units`);
        logger.info(`   Duration  : ${result.durationMs} ms`);
    } else {
        logger.error(`❌ Headed Scrape Demo Failed: ${result.error}`);
    }
}

runHeadedDemo();
