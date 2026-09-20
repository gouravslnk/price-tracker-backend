import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { decryptPricePayload, sha256Hex } from "../src/scraper/decrypt.js";
import { ScraperError } from "../src/scraper/errors.js";

test("Decryption: sha256Hex computes correct hex digest", () => {
    const hash = sha256Hex("hello-world");
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
});

test("Decryption: decrypts valid XOR payload correctly with session token", () => {
    const token = "mock-session-token-12345";
    const samplePayload = { p: 4821, s: 43, m: 4999, c: "INR" };
    const jsonStr = JSON.stringify(samplePayload);

    const key = crypto.createHash("sha256").update(`ine-mock-store-shared-k3y|enc|${token}`, "utf8").digest();

    const inputBuf = Buffer.from(jsonStr, "utf8");
    const encBuf = Buffer.alloc(inputBuf.length);
    for (let i = 0; i < inputBuf.length; i++) {
        encBuf[i] = inputBuf[i] ^ key[i % key.length];
    }
    const encryptedBase64 = encBuf.toString("base64");

    const decrypted = decryptPricePayload(encryptedBase64, token);
    assert.deepEqual(decrypted, samplePayload);
});

test("Decryption: throws ScraperError on missing token or invalid payload", () => {
    assert.throws(
        () => decryptPricePayload("", "token123"),
        (err) => err instanceof ScraperError && err.category === "DECRYPTION_ERROR"
    );

    assert.throws(
        () => decryptPricePayload("invalid-base64-payload", ""),
        (err) => err instanceof ScraperError && err.category === "DECRYPTION_ERROR"
    );
});
