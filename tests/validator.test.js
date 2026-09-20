import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePriceQuote, validateIneUrl } from "../src/scraper/validator.js";
import { ScraperError } from "../src/scraper/errors.js";

test("Validator: accepts valid price and stock > 0", () => {
    const raw = { p: 1499.50, s: 12, m: 1999, c: "INR" };
    const validated = validatePriceQuote(raw);
    assert.equal(validated.price, 1499.50);
    assert.equal(validated.stock, 12);
    assert.equal(validated.mrp, 1999);
    assert.equal(validated.currency, "INR");
});

test("Validator: accepts stock = 0 as valid out-of-stock product", () => {
    const raw = { p: 999, s: 0 };
    const validated = validatePriceQuote(raw);
    assert.equal(validated.price, 999);
    assert.equal(validated.stock, 0);
});

test("Validator: rejects negative price", () => {
    assert.throws(
        () => validatePriceQuote({ p: -10, s: 5 }),
        (err) => err instanceof ScraperError && err.category === "VALIDATION_ERROR"
    );
});

test("Validator: rejects negative stock", () => {
    assert.throws(
        () => validatePriceQuote({ p: 100, s: -2 }),
        (err) => err instanceof ScraperError && err.category === "VALIDATION_ERROR"
    );
});

test("Validator: rejects non-numeric price or missing price", () => {
    assert.throws(
        () => validatePriceQuote({ p: "abc", s: 5 }),
        (err) => err instanceof ScraperError
    );
    assert.throws(
        () => validatePriceQuote({ s: 5 }),
        (err) => err instanceof ScraperError
    );
});

test("Validator: validateIneUrl accepts target INE domain and rejects external URLs", () => {
    assert.equal(validateIneUrl("https://demo.inelabteamdev.com/product/274"), true);

    assert.throws(
        () => validateIneUrl("https://amazon.com/dp/B08N5WRWNW"),
        (err) => err instanceof ScraperError && err.category === "VALIDATION_ERROR"
    );

    assert.throws(
        () => validateIneUrl("http://random-scam-site.org"),
        (err) => err instanceof ScraperError
    );
});
