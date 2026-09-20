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
    // Detect if environment has GUI display capabilities (Linux cloud containers like Render lack $DISPLAY)
    const hasDisplay = process.platform !== "linux" || Boolean(process.env.DISPLAY);
    let requestedHeadless = options.isHeaded !== undefined ? !options.isHeaded : config.headless;

    if (!hasDisplay && !requestedHeadless) {
        logger.info("[Browser Manager] Cloud environment detected without GUI display ($DISPLAY missing). Forcing headless: true for stability.");
        requestedHeadless = true;
    }

    const isHeadless = requestedHeadless;

    if (sharedBrowser && sharedBrowser.isConnected()) {
        if (sharedBrowserIsHeadless === isHeadless) {
            return sharedBrowser;
        }
        logger.info(`[Browser Manager] Relaunching Chromium Browser for updated mode (Headless: ${isHeadless})`);
        await closeSharedBrowser();
    }

    logger.info(`[Browser Manager] Launching Chromium Browser (Headless: ${isHeadless})`);
    
    const launchOptions = {
        headless: isHeadless,
        slowMo: isHeadless ? 0 : 150,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu"
        ]
    };

    try {
        sharedBrowser = await chromium.launch(launchOptions);
    } catch (launchErr) {
        logger.warn(`[Browser Manager] Initial browser launch failed: ${launchErr.message}`);

        // If headed mode failed (e.g. display server issue on cloud), fall back to headless
        if (!isHeadless) {
            try {
                logger.info("[Browser Manager] Falling back to headless: true mode...");
                sharedBrowser = await chromium.launch({ ...launchOptions, headless: true, slowMo: 0 });
                sharedBrowserIsHeadless = true;
                return sharedBrowser;
            } catch (fallbackErr) {
                logger.warn("[Browser Manager] Headless fallback after headed failure also failed", fallbackErr);
            }
        }

        if (launchErr.message?.includes("Executable doesn't exist") || launchErr.message?.includes("Please run the following command")) {
            logger.warn("[Browser Manager] Chromium binary missing at runtime, auto-installing via npx playwright install...");
            const { execSync } = await import("child_process");
            try {
                execSync("npx playwright install chromium", { stdio: "inherit" });
                sharedBrowser = await chromium.launch({ ...launchOptions, headless: true });
                sharedBrowserIsHeadless = true;
                return sharedBrowser;
            } catch (installErr) {
                logger.error("[Browser Manager] Auto-install failed", installErr);
                throw installErr;
            }
        } else {
            throw launchErr;
        }
    }
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
