import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const mockStoreApi = {
    /**
     * Search and fetch live products directly from INE's mock storefront catalog API (/api/catalog)
     * @param {string} query - Optional partial or full product search term or store product ID
     */
    async searchProducts(query = "") {
        const q = String(query).trim();
        const searchUrl = `${config.mockStoreUrl}/api/catalog`;

        logger.info(`Fetching live catalog from INE mock store API: ${searchUrl} (query: "${q}")`);

        // 1. If query is a direct numeric store product ID (e.g. "275"), fetch single product directly first
        if (/^\d+$/.test(q)) {
            try {
                const single = await this.getProductDetails(q);
                if (single && single.name) {
                    return [single];
                }
            } catch {
                // Fall through to catalog search
            }
        }

        const maxAttempts = 3;
        let lastErr = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Fetch first 4 catalog pages in parallel (80 items across all store categories)
                const pages = q ? [1, 2, 3, 4] : [1, 2];
                const pageRequests = pages.map(p =>
                    fetch(`${searchUrl}?page=${p}`, { headers: { "Accept": "application/json" } })
                        .then(r => r.ok ? r.json() : { items: [] })
                        .catch(() => ({ items: [] }))
                );

                const pageResults = await Promise.all(pageRequests);
                const allItems = pageResults.flatMap(data => Array.isArray(data) ? data : (data.items || []));

                // De-duplicate items by ID
                const uniqueMap = new Map();
                allItems.forEach(item => {
                    if (item && item.id && !uniqueMap.has(String(item.id))) {
                        uniqueMap.set(String(item.id), item);
                    }
                });

                const items = Array.from(uniqueMap.values());

                let mapped = items.map(item => ({
                    id: String(item.id),
                    store_product_id: String(item.id),
                    name: item.name || `Product #${item.id}`,
                    sku: item.sku || `SKU-${item.id}`,
                    category: item.category || "General",
                    brand: item.brand || "",
                    description: item.description || "",
                    url: `${config.mockStoreUrl}/product/${item.id}`,
                    image_url: item.image || item.image_url || ""
                }));

                // Strict client-side search filtering
                if (q) {
                    const term = q.toLowerCase();
                    const terms = term.split(/\s+/).filter(Boolean);

                    mapped = mapped.filter(item => {
                        const searchableText = `${item.name} ${item.sku} ${item.category} ${item.brand} ${item.description} ${item.id}`.toLowerCase();
                        return terms.every(t => searchableText.includes(t));
                    });
                }

                return mapped;
            } catch (err) {
                lastErr = err;
                if (attempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, attempt * 800));
                }
            }
        }

        throw new Error(`Failed to fetch catalog from INE mock store after ${maxAttempts} attempts: ${lastErr?.message}`);
    },

    /**
     * Fetch details for a specific product directly from INE's live single-product API (/api/product/:id)
     * @param {string|number} productId - Store product ID (e.g., 275)
     */
    async getProductDetails(productId) {
        const idStr = String(productId);
        const productUrl = `${config.mockStoreUrl}/api/product/${encodeURIComponent(idStr)}`;

        logger.info(`Fetching live product details from INE mock store API: ${productUrl}`);

        const maxAttempts = 4;
        let lastErr = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const res = await fetch(productUrl, {
                    headers: { "Accept": "application/json" }
                });

                if (res.status === 429 || res.status >= 500) {
                    const backoffMs = attempt * 1200 + Math.random() * 500;
                    logger.warn(`Mock store product API returned HTTP ${res.status}. Retry attempt ${attempt}/${maxAttempts} in ${Math.round(backoffMs)}ms...`);
                    await new Promise(r => setTimeout(r, backoffMs));
                    continue;
                }

                if (res.status === 404) {
                    logger.info(`Product ${idStr} not found on INE mock store API (HTTP 404)`);
                    return null;
                }

                if (!res.ok) {
                    throw new Error(`Mock store product API returned HTTP status ${res.status}`);
                }

                const item = await res.json();

                return {
                    id: String(item.id || idStr),
                    store_product_id: String(item.id || idStr),
                    name: item.name || `Product #${idStr}`,
                    sku: item.sku || `SKU-${idStr}`,
                    category: item.category || "General",
                    brand: item.brand || "",
                    description: item.description || "",
                    specs: item.specs || null,
                    reviews: item.reviews || [],
                    url: `${config.mockStoreUrl}/product/${item.id || idStr}`,
                    image_url: item.image || item.image_url || ""
                };
            } catch (err) {
                lastErr = err;
                if (err.message && err.message.includes("404")) return null;
                if (attempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, attempt * 1000));
                }
            }
        }

        return null;
    }
};
