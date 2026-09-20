import { chromium } from "playwright";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

let sharedBrowser = null;
let sharedBrowserIsHeadless = null;

/**
 * Launch or return existing shared Chromium browser instance
 * @param {object} options - Options ({ isHeaded })
 */
export async function getBrowserInstance(options = {}) {
    const isHeadless = options.isHeaded !== undefined ? !options.isHeaded : config.headless;

    if (sharedBrowser && sharedBrowser.isConnected()) {
        if (sharedBrowserIsHeadless === isHeadless) {
            return sharedBrowser;
        }
        logger.info(`[Browser Manager] Relaunching Chromium Browser for updated mode (Headless: ${isHeadless})`);
        await closeSharedBrowser();
    }

    logger.info(`[Browser Manager] Launching Chromium Browser (Headless: ${isHeadless})`);
    sharedBrowser = await chromium.launch({
        headless: isHeadless,
        slowMo: isHeadless ? 0 : 150
    });
    sharedBrowserIsHeadless = isHeadless;

    return sharedBrowser;
}

/**
 * Create a fresh isolated browser context for a product scrape
 * @param {import('playwright').Browser} browser 
 */
export async function createFreshContext(browser) {
    return await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    });
}

/**
 * Safely close browser context
 * @param {import('playwright').BrowserContext} context 
 */
export async function closeContext(context) {
    if (context) {
        try {
            await context.close();
        } catch (err) {
            logger.warn("[Browser Manager] Error closing context", err);
        }
    }
}

/**
 * Safely close global shared browser instance
 */
export async function closeSharedBrowser() {
    if (sharedBrowser) {
        try {
            logger.info("[Browser Manager] Closing shared Chromium browser process");
            await sharedBrowser.close();
        } catch (err) {
            logger.warn("[Browser Manager] Error closing shared browser", err);
        } finally {
            sharedBrowser = null;
        }
    }
}
