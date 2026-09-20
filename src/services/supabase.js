import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

let supabaseClient = null;

export function getSupabaseClient() {
    if (!supabaseClient) {
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error("Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are missing in environment variables.");
        }
        supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
            auth: { persistSession: false }
        });
    }
    return supabaseClient;
}

/**
 * DB Helper Methods
 */
export const db = {
    // --- Tracked Products ---
    async getTrackedProducts(activeOnly = true) {
        const client = getSupabaseClient();
        let query = client.from("tracked_products").select("*").order("created_at", { ascending: false });
        if (activeOnly) {
            query = query.eq("is_active", true);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getTrackedProductByStoreId(storeProductId) {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .eq("store_product_id", String(storeProductId))
            .single();
        if (error && error.code !== "PGRST116") throw error; // PGRST116 is not found
        return data || null;
    },

    async getTrackedProductById(id) {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async addTrackedProduct(productData) {
        const client = getSupabaseClient();
        const payload = {
            store_product_id: String(productData.store_product_id),
            name: productData.name,
            sku: productData.sku || "",
            url: productData.url || `${config.mockStoreUrl}/product/${productData.store_product_id}`,
            image_url: productData.image_url || "",
            is_active: true
        };

        const { data, error } = await client
            .from("tracked_products")
            .upsert(payload, { onConflict: "store_product_id" })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateLastScrapedAt(trackedProductId) {
        const client = getSupabaseClient();
        const { error } = await client
            .from("tracked_products")
            .update({ last_scraped_at: new Date().toISOString() })
            .eq("id", trackedProductId);
        if (error) logger.error("Failed to update last_scraped_at", error);
    },

    async removeTrackedProduct(id) {
        const client = getSupabaseClient();
        const { error } = await client
            .from("tracked_products")
            .update({ is_active: false })
            .eq("id", id);
        if (error) throw error;
        return true;
    },

    // --- Price History ---
    async addPriceHistory(trackedProductId, price, stock, mrp = null, currency = "INR") {
        const client = getSupabaseClient();
        const payload = {
            tracked_product_id: trackedProductId,
            price: Number(price),
            stock: Number(stock),
            mrp: mrp ? Number(mrp) : null,
            currency: currency || "INR",
            scraped_at: new Date().toISOString()
        };

        const { data, error } = await client
            .from("price_history")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        // Update last_scraped_at timestamp on product
        await this.updateLastScrapedAt(trackedProductId);

        return data;
    },

    async getPriceHistory(trackedProductId, limit = 100, trackingStartedAt = null) {
        const client = getSupabaseClient();
        let query = client
            .from("price_history")
            .select("*")
            .eq("tracked_product_id", trackedProductId);

        if (trackingStartedAt) {
            query = query.gte("scraped_at", trackingStartedAt);
        }

        const { data, error } = await query
            .order("scraped_at", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    // --- Scrape Logs ---
    async addScrapeLog(logData) {
        const client = getSupabaseClient();
        const payload = {
            tracked_product_id: logData.tracked_product_id,
            attempt_number: Number(logData.attempt_number || 1),
            status: logData.status, // 'SUCCESS', 'RETRY', 'FAILED'
            http_status: logData.http_status ? Number(logData.http_status) : null,
            error_message: logData.error_message || null,
            duration_ms: logData.duration_ms ? Number(logData.duration_ms) : null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await client
            .from("scrape_logs")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getScrapeLogs(trackedProductId, limit = 100, trackingStartedAt = null) {
        const client = getSupabaseClient();
        let query = client
            .from("scrape_logs")
            .select("*")
            .eq("tracked_product_id", trackedProductId);

        if (trackingStartedAt) {
            query = query.gte("created_at", trackingStartedAt);
        }

        const { data, error } = await query
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }
};
