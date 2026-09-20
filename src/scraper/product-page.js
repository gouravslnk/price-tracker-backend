import { logger } from "../utils/logger.js";
import { ScraperError, ErrorCategory } from "./errors.js";
import { config } from "../config/env.js";
import { acceptCookies, ensureNoOverlay } from "./cookies.js";

/**
 * Navigate to product page and wait for initial load
 * @param {import('playwright').Page} page 
 * @param {string} targetUrl 
 */
export async function navigateToProduct(page, targetUrl) {
    logger.info(`[Browser Navigation] Navigating to: ${targetUrl}`);
    try {
        const response = await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: config.navigationTimeout
        });

        if (response) {
            const status = response.status();
            if (status === 404) {
                throw new ScraperError(ErrorCategory.PRODUCT_NOT_FOUND, `Product page returned 404 Not Found`, { httpStatus: 404, retryable: false });
            }
            if (status >= 400) {
                throw ScraperError.fromHttpStatus(status, `Product page navigation returned HTTP status ${status}`);
            }
        }

        // Check if page DOM displays an SPA product catalog load failure (Image 429 error)
        await page.waitForTimeout(300);
        const bodyText = await page.innerText("body").catch(() => "");
        if (bodyText.includes("Couldn't load this product") || bodyText.includes("product 429") || bodyText.includes("product 503")) {
            let status = 500;
            if (bodyText.includes("429")) status = 429;
            else if (bodyText.includes("503")) status = 503;
            else if (bodyText.includes("404")) status = 404;

            throw ScraperError.fromHttpStatus(status, `Store initial product fetch failed: ${bodyText.replace(/\s+/g, " ").trim().slice(0, 100)}`);
        }
    } catch (err) {
        if (err instanceof ScraperError) throw err;
        throw new ScraperError(
            ErrorCategory.NETWORK_ERROR,
            `Failed to navigate to product page (${targetUrl}): ${err.message}`,
            { retryable: true }
        );
    }
}

/**
 * Hover over price area to trigger minimum mouse movement and dwell requirements (Image 3 -> Image 4 transition)
 * @param {import('playwright').Page} page 
 */
export async function hoverPriceArea(page) {
    try {
        // Target the price container box (containing "Price hidden" or "Hover over the price area")
        const container = page.locator("div:has-text('Price hidden'), div:has-text('Hover over the price area'), div:has-text('Couldn\\'t load'), div:has-text('Retrying')").last();
        const isVisible = await container.isVisible({ timeout: 1500 }).catch(() => false);

        if (isVisible) {
            const box = await container.boundingBox();
            if (box) {
                const startX = box.x + 30;
                const startY = box.y + box.height / 2;

                await page.mouse.move(startX, startY);
                await container.dispatchEvent("mouseenter").catch(() => {});
                await container.dispatchEvent("mouseover").catch(() => {});

                // Move mouse smoothly across the box (12 steps with 60ms delay so each move exceeds 40ms store throttle)
                const steps = 12;
                for (let step = 0; step <= steps; step++) {
                    const curX = startX + ((box.width - 60) * (step / steps));
                    const curY = startY + (step % 2 === 0 ? 5 : -5);
                    await page.mouse.move(curX, curY);
                    await page.waitForTimeout(60);
                }
            }
        }

        // Satisfy minimum dwell time requirement (> 600ms total)
        await page.waitForTimeout(300);

        // Wait for button to become enabled
        const actionBtn = page.locator("button:has-text('REVEAL PRICE'), button:has-text('Reveal price'), button:has-text('TRY AGAIN'), button:has-text('Try again'), button:has-text('REFRESH PRICE'), button:has-text('Refresh price')").first();
        for (let check = 0; check < 15; check++) {
            if (await actionBtn.isEnabled().catch(() => false)) break;
            await page.waitForTimeout(100);
        }

        logger.info("[UI Interaction] Price area hovered & dwell time completed.");
    } catch (err) {
        logger.warn(`[UI Interaction] Price area hover warning: ${err.message}`);
    }
}

/**
 * Click REVEAL PRICE, TRY AGAIN, or REFRESH PRICE button
 * @param {import('playwright').Page} page 
 */
export async function clickRevealButton(page) {
    try {
        await ensureNoOverlay(page);
        const selector = "button:has-text('REVEAL PRICE'), button:has-text('Reveal price'), button:has-text('TRY AGAIN'), button:has-text('Try again'), button:has-text('REFRESH PRICE'), button:has-text('Refresh price'), button[aria-label*='Reveal'], button[aria-label*='Try']";
        const actionBtn = page.locator(selector).first();
        const isVisible = await actionBtn.isVisible({ timeout: 1000 }).catch(() => false);

        if (isVisible) {
            await actionBtn.hover({ force: true, timeout: 500 }).catch(() => {});
            await page.waitForTimeout(100);

            let isEnabled = await actionBtn.isEnabled().catch(() => false);
            if (!isEnabled) {
                await page.waitForTimeout(300);
                isEnabled = await actionBtn.isEnabled().catch(() => false);
            }

            if (isEnabled) {
                await actionBtn.click({ timeout: 2000 });
                logger.info("[UI Interaction] Clicked enabled REVEAL PRICE / TRY AGAIN / REFRESH PRICE button.");
            } else {
                logger.info("[UI Interaction] Button still disabled. Triggering JS click dispatch and forced click.");
                await actionBtn.dispatchEvent("click").catch(() => {});
                await actionBtn.click({ force: true, timeout: 1000 }).catch(() => {});
            }

            return true;
        } else {
            logger.info("[UI Interaction] Action button not visible.");
            return false;
        }
    } catch (err) {
        logger.warn(`[UI Interaction] Click button warning: ${err.message}`);
        return false;
    }
}
