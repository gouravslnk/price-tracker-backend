import crypto from "node:crypto";

const SHARED_KEY = "ine-mock-store-shared-k3y";

/**
 * SHA-256 Hex Digest
 */
export function sha256Hex(input) {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * 16-character dual accumulator fingerprint hash (ir)
 */
export function ir(e) {
    let t = 2166136261;
    let n = 16777619;
    for (let r = 0; r < e.length; r++) {
        t ^= e.charCodeAt(r);
        t = Math.imul(t, 16777619);
        n ^= e.charCodeAt(e.length - 1 - r);
        n = Math.imul(n, 2246822507);
    }
    return ((t >>> 0).toString(16).padStart(8, "0") + (n >>> 0).toString(16).padStart(8, "0")).slice(0, 16);
}

/**
 * Decrypt mock store opaque price payload `e` using Bearer session token
 */
export function decryptPrice(e, token) {
    if (!e || !token) {
        throw new Error("Cannot decrypt price payload: missing 'e' or 'token'");
    }

    const key = crypto
        .createHash("sha256")
        .update(`${SHARED_KEY}|enc|${token}`, "utf8")
        .digest();

    const encrypted = Buffer.from(e, "base64");
    const output = Buffer.alloc(encrypted.length);

    for (let i = 0; i < encrypted.length; i++) {
        output[i] = encrypted[i] ^ key[i % key.length];
    }

    const jsonStr = output.toString("utf8");
    return JSON.parse(jsonStr);
}
