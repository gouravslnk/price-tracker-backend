export const ErrorCategory = {
    AUTH_ERROR: "AUTH_ERROR",
    RATE_LIMIT: "RATE_LIMIT",
    SERVER_ERROR: "SERVER_ERROR",
    TIMEOUT: "TIMEOUT",
    NETWORK_ERROR: "NETWORK_ERROR",
    STORE_UI_FAILURE: "STORE_UI_FAILURE",
    DECRYPTION_ERROR: "DECRYPTION_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
    COOKIE_ERROR: "COOKIE_ERROR",
    UNKNOWN_ERROR: "UNKNOWN_ERROR"
};

export class ScraperError extends Error {
    /**
     * @param {string} category - Category from ErrorCategory
     * @param {string} message - Descriptive error message
     * @param {object} options - Optional details ({ httpStatus, retryable, productId, attempt })
     */
    constructor(category, message, options = {}) {
        super(message);
        this.name = "ScraperError";
        this.category = category || ErrorCategory.UNKNOWN_ERROR;
        this.type = this.category;
        this.httpStatus = options.httpStatus || null;
        this.retryable = options.retryable !== undefined ? options.retryable : true;
        this.productId = options.productId || null;
        this.attempt = options.attempt || null;
    }

    /**
     * Helper method to map HTTP status codes to ScraperError categories
     * @param {number} status 
     * @param {string} msg 
     */
    static fromHttpStatus(status, msg = "") {
        if (status === 401 || status === 403) {
            return new ScraperError(ErrorCategory.AUTH_ERROR, msg || `Store authorization failure (HTTP ${status})`, { httpStatus: status, retryable: true });
        }
        if (status === 429) {
            return new ScraperError(ErrorCategory.RATE_LIMIT, msg || `Store rate limited (HTTP 429)`, { httpStatus: status, retryable: true });
        }
        if (status === 408) {
            return new ScraperError(ErrorCategory.TIMEOUT, msg || `Request timeout (HTTP 408)`, { httpStatus: status, retryable: true });
        }
        if ([500, 502, 503, 504].includes(status)) {
            return new ScraperError(ErrorCategory.SERVER_ERROR, msg || `Store upstream server error (HTTP ${status})`, { httpStatus: status, retryable: true });
        }
        if (status === 404) {
            return new ScraperError(ErrorCategory.PRODUCT_NOT_FOUND, msg || `Product page not found (HTTP 404)`, { httpStatus: status, retryable: false });
        }
        if (status >= 400 && status < 500) {
            return new ScraperError(ErrorCategory.UNKNOWN_ERROR, msg || `Client error (HTTP ${status})`, { httpStatus: status, retryable: false });
        }
        return new ScraperError(ErrorCategory.UNKNOWN_ERROR, msg || `Unexpected error (HTTP ${status})`, { httpStatus: status, retryable: true });
    }
}
