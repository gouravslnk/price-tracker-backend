import { logger } from "../utils/logger.js";
import { decryptPricePayload } from "./decrypt.js";
import { validatePriceQuote } from "./validator.js";

/**
 * Setup response listener on Playwright page to intercept mock store API responses
 * @param {import('playwright').Page} page 
 * @param {string|number} storeProductId 
 * @param {object} stateHolder - Mutable state holder ({ latestQuote, lastHttpStatus, lastError })
 */
export function setupNetworkInterceptor(page, storeProductId, stateHolder) {
    const productIdStr = String(storeProductId);

    page.on("response", async (response) => {
        const url = response.url();

        // 1. Challenge response
        if (url.includes("/api/challenge")) {
            logger.info(`[Network Capture] GET /api/challenge -> Status ${response.status()}`);
        }

        // 2. Session creation response
        if (url.includes("/api/session")) {
            logger.info(`[Network Capture] POST /api/session -> Status ${response.status()}`);
        }

        // 3. Price endpoint response
        if (url.includes(`/api/products/${productIdStr}/price`)) {
            const status = response.status();
            stateHolder.lastHttpStatus = status;

            logger.info(`[Network Capture] GET /api/products/${productIdStr}/price -> Status ${status}`);

            if (status === 200) {
                try {
                    const req = response.request();
                    const authHeader = req.headers()["authorization"] || "";
                    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
                    const body = await response.json();

                    if (body && body.e && token) {
                        // Decrypt opaque payload
                        const rawDecrypted = decryptPricePayload(body.e, token);
                        // Validate numeric price & integer stock requirements
                        const validatedQuote = validatePriceQuote(rawDecrypted);

                        stateHolder.latestQuote = validatedQuote;
                        logger.info(`[Decrypt & Validate Success] Price: ₹${validatedQuote.price}, Stock: ${validatedQuote.stock}`);
                    } else if (!token) {
                        stateHolder.lastError = "Missing Bearer token in price API authorization header";
                    } else if (!body.e) {
                        stateHolder.lastError = "Price API response missing encrypted 'e' payload";
                    }
                } catch (err) {
                    logger.error(`[Decrypt & Validate Error] ${err.message}`);
                    stateHolder.lastError = err.message;
                }
            } else {
                stateHolder.lastError = `Mock store price API returned HTTP ${status}`;
            }
        }
    });
}
