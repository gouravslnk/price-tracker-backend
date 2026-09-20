import { logger } from "../utils/logger.js";

/**
 * Detect, click ACCEPT, and purge cookie popup & modal backdrop overlay from DOM (Image 1)
 * @param {import('playwright').Page} page 
 */
export async function acceptCookies(page) {
    try {
        const acceptBtn = page.locator("button:has-text('ACCEPT'), button:has-text('Accept'), button:has-text('Allow All'), button:has-text('Allow')").first();
        
        // Check if accept button is present immediately (500ms timeout)
        let visible = await acceptBtn.isVisible({ timeout: 500 }).catch(() => false);
        if (visible) {
            await acceptBtn.click({ force: true, timeout: 1000 }).catch(() => {});
            logger.info("[Cookie Consent] Clicked ACCEPT button on cookie modal.");
            await page.waitForTimeout(200);
        }

        // Always purge any cookie modal backdrop overlay elements intercepting pointer events from DOM
        await page.evaluate(() => {
            const selectors = [
                ".cookie-overlay",
                ".cookie-banner",
                ".cookie-modal",
                ".cookie-backdrop",
                ".modal-backdrop"
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });

            // Also check elements containing cookie consent text
            document.querySelectorAll("div").forEach(el => {
                if (el.innerText && el.innerText.includes("We use cookies to make this store work")) {
                    el.remove();
                }
            });
        }).catch(() => {});

        logger.info("[Cookie Consent] Cookie modal check & overlay purge completed.");
    } catch (err) {
        logger.warn(`[Cookie Consent] Cookie handling warning: ${err.message}`);
    }
}

/**
 * Helper to purge any async mounted cookie overlays right before click actions
 * @param {import('playwright').Page} page 
 */
export async function ensureNoOverlay(page) {
    try {
        await page.evaluate(() => {
            const selectors = [
                ".cookie-overlay",
                ".cookie-banner",
                ".cookie-modal",
                ".cookie-backdrop",
                ".modal-backdrop"
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });
        }).catch(() => {});
    } catch {}
}
