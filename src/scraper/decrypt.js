import crypto from "node:crypto";
import { ScraperError, ErrorCategory } from "./errors.js";

const SHARED_KEY = "ine-mock-store-shared-k3y";

/**
 * SHA-256 Hex Digest
 */
export function sha256Hex(input) {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Decrypt mock store opaque price payload `e` using Bearer session token
 * @param {string} encryptedBase64 - Encrypted Base64 payload string `e`
 * @param {string} sessionToken - Bearer session token
 * @returns {object} Decrypted JSON object
 */
export function decryptPricePayload(encryptedBase64, sessionToken) {
    if (!encryptedBase64 || typeof encryptedBase64 !== "string") {
        throw new ScraperError(
            ErrorCategory.DECRYPTION_ERROR,
            "Cannot decrypt payload: missing or invalid encrypted Base64 string 'e'",
            { retryable: false }
        );
    }
    if (!sessionToken || typeof sessionToken !== "string") {
        throw new ScraperError(
            ErrorCategory.DECRYPTION_ERROR,
            "Cannot decrypt payload: missing or invalid session token",
            { retryable: true }
        );
    }

    try {
        const key = crypto
            .createHash("sha256")
            .update(`${SHARED_KEY}|enc|${sessionToken}`, "utf8")
            .digest();

        const encrypted = Buffer.from(encryptedBase64, "base64");
        if (encrypted.length === 0) {
            throw new Error("Decoded Base64 buffer is empty");
        }

        const output = Buffer.alloc(encrypted.length);
        for (let i = 0; i < encrypted.length; i++) {
            output[i] = encrypted[i] ^ key[i % key.length];
        }

        const jsonStr = output.toString("utf8");
        const parsed = JSON.parse(jsonStr);

        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Decrypted payload is not a valid JSON object");
        }

        return parsed;
    } catch (err) {
        throw new ScraperError(
            ErrorCategory.DECRYPTION_ERROR,
            `Failed to decrypt price payload: ${err.message}`,
            { retryable: true }
        );
    }
}
