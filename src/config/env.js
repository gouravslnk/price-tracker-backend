import dotenv from "dotenv";

dotenv.config();

export const config = {
    get port() { return parseInt(process.env.PORT || "5000", 10); },
    get nodeEnv() { return process.env.NODE_ENV || "development"; },
    get supabaseUrl() { return process.env.SUPABASE_URL || ""; },
    get supabaseKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ""; },
    get mockStoreUrl() { return process.env.MOCK_STORE_URL || "https://demo.inelabteamdev.com"; },
    get cronSecret() { return process.env.CRON_SECRET || process.env.INTERNAL_CRON_SECRET || "ine-default-cron-secret"; },
    
    // Scraper Configuration & Tuning
    get maxScrapeAttempts() { return parseInt(process.env.MAX_SCRAPE_ATTEMPTS || "6", 10); },
    get scrapeConcurrency() { return parseInt(process.env.SCRAPE_CONCURRENCY || "2", 10); },
    get screenshotOnFailure() { return process.env.SCREENSHOT_ON_FAILURE === "true"; },
    get scraperDebug() { return process.env.SCRAPER_DEBUG === "true"; },
    get demoMode() { return process.env.DEMO_MODE === "true"; },
    get headless() {
        dotenv.config({ override: true });
        const val = String(process.env.HEADLESS ?? "true").trim().toLowerCase();
        return val !== "false" && val !== "0" && val !== "no";
    },

    // Timeouts
    get navigationTimeout() { return parseInt(process.env.NAVIGATION_TIMEOUT || "30000", 10); },
    get pageLoadTimeout() { return parseInt(process.env.PAGE_LOAD_TIMEOUT || "45000", 10); },
    get priceTimeout() { return parseInt(process.env.PRICE_TIMEOUT || "45000", 10); },
    get apiWaitTimeout() { return parseInt(process.env.API_WAIT_TIMEOUT || "30000", 10); },
    get browserOperationTimeout() { return parseInt(process.env.BROWSER_OPERATION_TIMEOUT || "10000", 10); }
};

export const validateEnv = () => {
    if (!config.supabaseUrl || !config.supabaseKey) {
        console.warn("⚠️  [ENV WARNING] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing! Database functionality will require valid env vars.");
    }
};

