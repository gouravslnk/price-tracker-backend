import { ScraperError, ErrorCategory } from "./errors.js";
import { config } from "../config/env.js";

/**
 * Validates decrypted price quote payload
 * @param {object} quote - Decrypted JSON payload
 * @returns {object} Validated quote object { price, stock, mrp, currency, rating, seller, ... }
 */
export function validatePriceQuote(quote) {
    if (!quote || typeof quote !== "object") {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            "Price quote payload is null or not an object",
            { retryable: true }
        );
    }

    // 1. Validate Price (field 'p')
    const rawPrice = quote.p;
    if (rawPrice === undefined || rawPrice === null) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            "Price field 'p' is missing from payload",
            { retryable: true }
        );
    }

    const price = Number(rawPrice);
    if (typeof price !== "number" || isNaN(price) || !isFinite(price)) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            `Price '${rawPrice}' is not a valid finite number`,
            { retryable: true }
        );
    }
    if (price < 0) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            `Price '${price}' cannot be negative`,
            { retryable: false }
        );
    }

    // 2. Validate Stock (field 's')
    const rawStock = quote.s;
    if (rawStock === undefined || rawStock === null) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            "Stock field 's' is missing from payload",
            { retryable: true }
        );
    }

    const stock = Number(rawStock);
    if (typeof stock !== "number" || isNaN(stock) || !isFinite(stock) || !Number.isInteger(stock)) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            `Stock '${rawStock}' is not a valid integer`,
            { retryable: true }
        );
    }
    if (stock < 0) {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            `Stock '${stock}' cannot be negative`,
            { retryable: false }
        );
    }

    // Optional fields
    const mrp = quote.m !== undefined && quote.m !== null ? Number(quote.m) : null;
    const currency = (quote.c && typeof quote.c === "string") ? quote.c : "INR";

    return {
        price,
        stock,
        mrp: (mrp !== null && !isNaN(mrp) && isFinite(mrp)) ? mrp : null,
        currency,
        seller: quote.sl || null,
        rating: quote.r !== undefined ? Number(quote.r) : null,
        ratingCount: quote.rc !== undefined ? Number(quote.rc) : null,
        deliveryDays: quote.dd !== undefined ? Number(quote.dd) : null
    };
}

/**
 * Validates that a product URL belongs strictly to the target INE mock store
 * @param {string} urlStr - Target product URL
 * @returns {boolean} True if valid
 */
export function validateIneUrl(urlStr) {
    if (!urlStr || typeof urlStr !== "string") {
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            "Product URL is required and must be a string",
            { retryable: false }
        );
    }

    try {
        const parsed = new URL(urlStr);
        const allowed = new URL(config.mockStoreUrl);

        // Allow demo.inelabteamdev.com and localhost for dev/testing
        const isAllowedDomain =
            parsed.hostname === allowed.hostname ||
            parsed.hostname === "demo.inelabteamdev.com" ||
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1";

        if (!isAllowedDomain) {
            throw new ScraperError(
                ErrorCategory.VALIDATION_ERROR,
                `Invalid product URL hostname '${parsed.hostname}'. Only INE mock store (${allowed.hostname}) is supported.`,
                { retryable: false }
            );
        }
        return true;
    } catch (err) {
        if (err instanceof ScraperError) throw err;
        throw new ScraperError(
            ErrorCategory.VALIDATION_ERROR,
            `Malformed product URL '${urlStr}': ${err.message}`,
            { retryable: false }
        );
    }
}
