import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../src/app.js";

let server;
let baseUrl;

before((_, done) => {
    server = http.createServer(app);
    server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        done();
    });
});

after((_, done) => {
    server.close(done);
});

test("API: GET /health returns exact spec response format", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.status, "ok");
    assert.equal(data.service, "ine-price-tracker-backend");
    assert.ok(data.timestamp);
});

test("API: POST /api/internal/scrape-all rejects unauthorized requests in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const res = await fetch(`${baseUrl}/api/internal/scrape-all`, {
        method: "POST"
    });
    const data = await res.json();

    process.env.NODE_ENV = originalEnv;

    assert.equal(res.status, 401);
    assert.equal(data.success, false);
    assert.ok(data.error);
});

test("API: POST /api/internal/scrape-all rejects invalid secret header", async () => {
    const res = await fetch(`${baseUrl}/api/internal/scrape-all`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer invalid-wrong-secret"
        }
    });
    const data = await res.json();

    assert.equal(res.status, 401);
    assert.equal(data.success, false);
});

