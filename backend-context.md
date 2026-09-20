You are a senior full-stack/backend engineer. Build the complete production-quality backend for my INE Software Engineer Intern assignment.

The assignment is a Product Price Tracker for the INE mock e-commerce store.

IMPORTANT:
Do not give me a toy scraper.
Do not implement only the happy path.
Do not fake browser fingerprints, attestation, price, stock, or API responses.
Do not silently convert missing values to 0/null.
Build a robust, fail-safe, observable backend that handles the intentionally unreliable mock store.

============================================================
1. ORIGINAL ASSIGNMENT GOAL
============================================================

We need to build a Product Price Tracker for:

https://demo.inelabteamdev.com/

The application should allow a user to:

1. Search/browse products from the INE mock store.
2. Select a product.
3. Add it to tracked products.
4. Store the product metadata in Supabase PostgreSQL.
5. Scrape the current price and stock periodically.
6. Run scraping approximately every 2 hours.
7. Store successful price/stock observations in price_history.
8. Store every scraping attempt, including failures and retries, in scrape_logs.
9. Display price history later from the database.
10. Show scraping/error information per product.

The mock store is intentionally difficult:
- price can be hidden initially
- price is revealed through UI interaction
- hover interaction is involved
- there is a REVEAL PRICE button
- the store can be slow
- the store can return errors
- the store can retry internally
- the store can return statuses such as 200, 401, 429, 500, 503
- the frontend can display:
  - Loading current price...
  - Retrying (attempt X/6)...
  - Store responded with "upstream 503".
  - Couldn't load the price after 6 attempts.
  - TRY AGAIN
  - Updating...
- scraping reliability is an important part of the assignment
- the assignment requires a headed browser recording demonstrating handling of slow/failing behavior

Only scrape the INE mock store.

============================================================
2. TECHNOLOGY STACK
============================================================

Use:

Backend:
- Node.js
- Express
- JavaScript or TypeScript, preferably TypeScript if it does not unnecessarily complicate setup
- native fetch where appropriate
- Playwright for browser automation
- Chromium

Database:
- Supabase PostgreSQL

Scheduling:
- external cron/scheduler or Render-compatible scheduled trigger
- DO NOT rely only on setInterval because the Render process may restart/sleep
- expose an authenticated internal endpoint such as:
  POST /api/internal/scrape-all

Environment:
- local development
- Render deployment

The frontend will eventually be React/Vercel, but focus on backend now.

============================================================
3. IMPORTANT SCRAPING ARCHITECTURE DECISION
============================================================

Use a HYBRID / BROWSER-FIRST architecture.

Do NOT build a pure HTTP scraper that tries to fake the browser's attestation.

Do NOT generate fake canvas hashes.

Do NOT hard-code GPU/WebGL values.

Do NOT hard-code screen dimensions or hardware concurrency as if they were real browser values.

Do NOT generate fake mouse movements and simply set trusted=true.

The mock store has a browser-side security/challenge flow.

The correct approach is:

Playwright Chromium
    |
    +--> open store
    |
    +--> accept cookies if present
    |
    +--> navigate to product
    |
    +--> interact with product page
    |
    +--> hover price area
    |
    +--> click REVEAL PRICE
    |
    +--> allow the store's own frontend JavaScript to perform:
          GET /api/challenge
              |
              +--> real browser attestation
              |
              +--> proof of work
              |
              +--> WASM computation
              |
              +--> POST /api/session
              |
              +--> session token
              |
              +--> GET /api/products/{productId}/price
    |
    +--> capture the real /api/session response
    |
    +--> capture the real price API response
    |
    +--> decrypt encrypted price payload using actual session token
    |
    +--> validate price/stock
    |
    +--> write successful observation to Supabase

This means Playwright handles browser-specific behavior, while Node performs deterministic post-processing/decryption and database operations.

Do not unnecessarily reimplement the store's browser security system if the browser can legitimately execute it itself.

============================================================
4. KNOWN REVERSE-ENGINEERED STORE FLOW
============================================================

The store's frontend performs approximately:

1. GET /api/challenge

2. Browser/client computes:
   - attestation
   - seed
   - WASM output
   - proof-of-work nonce
   - derived value

3. POST /api/session

4. Receives:
   {
     token,
     expiresInMs: 30000
   }

5. GET:

   /api/products/{productId}/price

   with:

   Authorization: Bearer <token>

6. Response looks like:

   {
     productId,
     v,
     e,
     serverTime
   }

7. `e` is encrypted.

8. The browser decrypts it using:

   SHA256(
       "ine-mock-store-shared-k3y|enc|" + sessionToken
   )

9. The decrypted JSON contains fields including:

   p  = current/display price
   m  = MRP
   n  = sale price
   b  = badge percentage
   s  = stock
   c  = currency
   t  = server timestamp
   r  = rating
   rc = rating count
   sl = seller
   dd = delivery days
   v  = variant
   g  = additional frontend state
   f  = format
   x  = triple flag

Required fields for our tracker:

- p
- s

Optional useful fields:

- m
- c
- t
- r
- rc
- sl
- dd
- v

Use the real session token from the actual browser flow.

Never hard-code or manufacture a token.

============================================================
5. COOKIE HANDLING
============================================================

Every new browser context may show a cookie popup.

Implement:

acceptCookies(page)

It should:

1. Detect whether cookie consent exists.
2. If it exists:
   - click the appropriate Accept/Accept All button.
3. If it does not exist:
   - continue normally.
4. Do not fail the scrape simply because the cookie popup is absent.
5. Do not repeatedly click arbitrary buttons.
6. Use robust selectors and fallback selectors.
7. Log whether the popup was:
   - detected and accepted
   - not present
   - present but could not be accepted

Important:
Cookie acceptance failure should only become fatal if the cookie popup blocks interaction with the product page.

============================================================
6. PRODUCT NAVIGATION
============================================================

Each tracked product contains:

- internal database UUID
- store_product_id
- name
- SKU
- URL
- image URL
- active flag

For each active product:

1. Open a fresh Playwright browser context.
2. Navigate to the stored product URL.
3. Use explicit timeouts.
4. Wait for DOM/content to become available.
5. Allow some additional time for React/dynamic rendering.
6. Never assume networkidle will always occur because the site may have ongoing requests.
7. If navigation fails:
   - log the failure
   - retry according to retry policy
   - do not write price history

============================================================
7. PRICE REVEAL WORKFLOW
============================================================

The browser workflow should be:

1. Open product page.
2. Accept cookies.
3. Wait for product UI.
4. Locate price area.
5. Hover over the price area.
6. Wait briefly for UI interaction.
7. Locate REVEAL PRICE button.
8. Click it using real Playwright interaction.
9. Wait for the store to load/retry the price.

Do not bypass this by directly requesting the price endpoint before performing the normal page interaction.

The browser should be allowed to execute the store's own JavaScript.

============================================================
8. STORE INTERNAL RETRIES
============================================================

The store itself can retry price retrieval internally.

Known behavior:

Maximum internal attempts:
6

Possible UI:

Loading current price...

Retrying (attempt 3/6)...

Store responded with "upstream 503".

Couldn't load the price after 6 attempts.

TRY AGAIN

Our scraper must monitor this.

Do NOT interfere with the store's own retry loop unnecessarily.

Wait for the store's attempt to finish before deciding that the entire scrape attempt failed.

If the store reaches:

"Couldn't load the price after 6 attempts"

then:

1. Record that failure.
2. Do not save price_history.
3. Optionally capture screenshot.
4. Let our outer retry policy decide whether to restart the browser flow.

============================================================
9. OUTER RETRY STRATEGY
============================================================

Use two retry layers.

Layer 1:
The store's own internal retry mechanism.

Layer 2:
Our scraper retry mechanism.

Our scraper should use a maximum configurable number of attempts, e.g.:

MAX_SCRAPE_ATTEMPTS = 4

or 5/6 if appropriate after testing.

Use exponential backoff with jitter.

Example:

attempt 1:
1-1.5 seconds

attempt 2:
2-2.5 seconds

attempt 3:
4-4.5 seconds

attempt 4:
8-8.5 seconds

Cap the maximum delay.

Do NOT use aggressive loops that hammer the server.

============================================================
10. ERROR CLASSIFICATION
============================================================

Create a central error classification system.

Categories:

AUTH_ERROR
RATE_LIMIT
SERVER_ERROR
TIMEOUT
NETWORK_ERROR
STORE_UI_FAILURE
DECRYPTION_ERROR
VALIDATION_ERROR
PRODUCT_NOT_FOUND
COOKIE_ERROR
UNKNOWN_ERROR

HTTP behavior:

401:
session/authentication invalid
-> restart complete scrape flow

403:
authentication/authorization issue
-> restart complete scrape flow

408:
timeout
-> retry

429:
rate limited
-> exponential backoff + jitter

500:
retry

502:
retry

503:
retry

504:
retry

Other 4xx:
usually non-retryable unless clearly known to be transient

Network timeout:
retry

Browser crash:
restart browser/context and retry

Page crash:
restart context and retry

Invalid encrypted payload:
retry once/according to retry policy

Invalid decrypted JSON:
retry

Missing price:
retry

Missing stock:
retry

Negative price:
invalid
never save

Negative stock:
invalid
never save

NaN:
never save

Infinity:
never save

============================================================
11. CRITICAL DATABASE INTEGRITY RULE
============================================================

NEVER insert fake or incomplete price data.

Never do:

price = price || 0

stock = stock || 0

price = null

stock = null

when the scrape failed.

Never use placeholder values to make the database look complete.

If price or stock cannot be confidently obtained:

DO NOT INSERT INTO price_history.

Instead:

INSERT INTO scrape_logs

with:

status = RETRY

or

status = FAILED

and a useful error_message.

Only insert price_history when all mandatory fields are valid.

============================================================
12. PRICE VALIDATION
============================================================

Before inserting:

price must:

- exist
- be a number
- be finite
- be >= 0

stock must:

- exist
- be an integer
- be >= 0

currency:

- use actual decrypted currency if available
- default to INR only if the store legitimately omits it and assignment requirements allow this

Never invent values.

Optional fields may remain absent if the store does not provide them.

Required:

price
stock

If either is missing:

scrape fails.

============================================================
13. DECRYPTION
============================================================

Implement a dedicated module:

src/scraper/decrypt.js

Function:

decryptPricePayload(encryptedBase64, sessionToken)

Key:

SHA256(
  "ine-mock-store-shared-k3y|enc|" + sessionToken
)

Decode `e` from Base64.

XOR each byte against the repeating SHA-256 key.

Convert decrypted bytes to UTF-8.

Parse JSON.

Validate the result.

If decryption fails:

throw a typed DECRYPTION_ERROR.

Never save partially decrypted information.

Never log the session token.

Never log the full decrypted secret payload if it contains sensitive internal fields unnecessarily.

============================================================
14. SESSION TOKEN SECURITY
============================================================

The session token:

- must never be stored in Supabase
- must never be written to logs
- must never appear in API responses
- must never appear in screenshots
- must never appear in error messages
- should exist only in memory for the duration of a scrape

Capture it from the actual browser response.

Expected:

POST /api/session

response:

{
  token,
  expiresInMs
}

If token is missing:

throw AUTH_ERROR.

If token expires:

restart the browser flow.

============================================================
15. NETWORK RESPONSE CAPTURE
============================================================

Use Playwright response listeners.

Capture:

/api/challenge

/api/session

/api/products/{productId}/price

Do not capture unrelated network traffic unnecessarily.

For every relevant response, record:

- URL/path
- HTTP status
- timestamp
- duration if possible

Do NOT log Authorization headers.

Do NOT log tokens.

Do NOT log cookies.

============================================================
16. SCRAPE LOGGING
============================================================

For every scraper attempt insert a row into:

scrape_logs

Fields:

tracked_product_id
attempt_number
status
http_status
error_message
duration_ms
created_at

Statuses:

SUCCESS
RETRY
FAILED

Example:

attempt 1:
503
RETRY

attempt 2:
429
RETRY

attempt 3:
200
SUCCESS

Only the final successful attempt inserts price_history.

Every failed attempt must still have a scrape_logs row.

If all attempts fail:

last attempt:

FAILED

Do not insert price_history.

============================================================
17. PRICE HISTORY
============================================================

When and ONLY when scraping succeeds:

Insert:

tracked_product_id
price
mrp
stock
currency
scraped_at

Never overwrite historical rows.

Every successful scrape creates a new observation.

Example:

09:00 -> ₹4821 / stock 43
11:00 -> ₹4799 / stock 39
13:00 -> ₹4799 / stock 37

All three should exist.

============================================================
18. TRACKED PRODUCTS
============================================================

Use:

tracked_products

Fields:

id
store_product_id
name
sku
url
image_url
is_active
last_scraped_at
created_at
updated_at

When a successful scrape occurs:

update:

last_scraped_at = NOW()

Do not update last_scraped_at after a failed scrape.

If product becomes inactive:

do not scrape it.

============================================================
19. PRODUCT BATCH SCRAPING
============================================================

Create:

scrapeAllActiveProducts()

Workflow:

1. Fetch all active tracked_products.
2. Process each product.
3. If one product fails:
   - log failure
   - continue with next product.
4. Never terminate the entire batch because one product failed.
5. Limit concurrency.

Do NOT open 100 Chromium instances simultaneously.

Use configurable concurrency such as:

SCRAPE_CONCURRENCY=2

or 3.

Use a simple worker pool/queue.

Example:

Product 1 -> worker 1
Product 2 -> worker 2

when worker 1 finishes:

Product 3 -> worker 1

This prevents resource exhaustion.

============================================================
20. BROWSER LIFECYCLE
============================================================

Prefer:

one browser process per batch

but:

fresh browser context per product

This gives isolation.

Example:

chromium.launch()

for each product:

browser.newContext()

scrape

context.close()

At the end:

browser.close()

If the browser crashes:

restart browser.

Do not leave Chromium processes running.

============================================================
21. TIMEOUTS
============================================================

Use explicit timeouts.

Suggested defaults:

NAVIGATION_TIMEOUT=30s

PAGE_LOAD_TIMEOUT=45s

PRICE_TIMEOUT=45s

API_WAIT_TIMEOUT=30s

BROWSER_OPERATION_TIMEOUT=10s

These must be configurable using environment variables.

Never wait forever.

============================================================
22. SCREENSHOTS AND DEBUGGING
============================================================

On failure:

capture screenshot when useful.

File name:

product-{store_product_id}-attempt-{attempt}.png

Only enable this through configuration:

SCREENSHOT_ON_FAILURE=true

Also optionally save a small diagnostic JSON:

- product ID
- attempt
- error category
- relevant HTTP statuses
- timestamp
- duration

Never include:

session token
Authorization header
cookies

============================================================
23. HEALTH ENDPOINT
============================================================

Create:

GET /health

Response:

{
  "status": "ok",
  "service": "ine-price-tracker-backend",
  "timestamp": "..."
}

Do not expose secrets.

============================================================
24. INTERNAL SCRAPE ENDPOINT
============================================================

Create:

POST /api/internal/scrape-all

This endpoint triggers the scheduled scrape.

Protect it with:

INTERNAL_CRON_SECRET

Require:

Authorization: Bearer <secret>

or an equivalent secure header.

If unauthorized:

401.

Do not allow arbitrary public users to trigger scraping.

Also create optionally:

POST /api/internal/scrape/:productId

for testing one product.

Protect it with the same secret.

============================================================
25. MANUAL SCRAPE ENDPOINT
============================================================

Create an endpoint for development/testing:

POST /api/products/:id/scrape

It should:

1. verify product exists
2. verify active
3. run scraper
4. return sanitized result

Do not return:

session token
cookies
internal browser information
attestation payload

Return:

{
  success: true,
  productId,
  price,
  stock,
  currency,
  scrapedAt
}

On failure:

{
  success: false,
  productId,
  error: {
    type,
    message
  }
}

============================================================
26. TRACK PRODUCT API
============================================================

Create:

POST /api/products/track

Input:

{
  storeProductId,
  name,
  sku,
  url,
  imageUrl
}

Validate:

- storeProductId required
- name required
- URL must belong to the INE mock store
- do not allow arbitrary external URLs

Only the INE mock store should be scraped.

If product already exists:

return existing product rather than creating duplicate.

============================================================
27. GET TRACKED PRODUCTS
============================================================

Create:

GET /api/products/tracked

Return active tracked products.

Do not expose database credentials.

============================================================
28. GET PRICE HISTORY
============================================================

Create:

GET /api/products/:id/history

Return:

- price
- mrp
- stock
- currency
- scraped_at

ordered:

scraped_at DESC

Add pagination if appropriate.

============================================================
29. GET SCRAPE LOGS
============================================================

Create:

GET /api/products/:id/scrape-logs

Return:

- attempt number
- status
- HTTP status
- error message
- duration
- created_at

Never return tokens or browser secrets.

============================================================
30. SUPABASE
============================================================

Use Supabase PostgreSQL.

Tables:

tracked_products

price_history

scrape_logs

Schema:

tracked_products:
- id UUID PK
- store_product_id VARCHAR UNIQUE NOT NULL
- name VARCHAR NOT NULL
- sku VARCHAR
- url VARCHAR NOT NULL
- image_url VARCHAR
- is_active BOOLEAN DEFAULT TRUE
- last_scraped_at TIMESTAMPTZ
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()

price_history:
- id UUID PK
- tracked_product_id UUID FK
- price NUMERIC NOT NULL
- mrp NUMERIC
- stock INTEGER NOT NULL
- currency VARCHAR DEFAULT INR
- scraped_at TIMESTAMPTZ DEFAULT NOW()

scrape_logs:
- id UUID PK
- tracked_product_id UUID FK
- attempt_number INTEGER
- status VARCHAR
- http_status INTEGER
- error_message TEXT
- duration_ms INTEGER
- created_at TIMESTAMPTZ DEFAULT NOW()

Use proper indexes.

Use parameterized queries.

Never construct SQL using string interpolation from user input.

============================================================
31. TRANSACTION / DATABASE CONSISTENCY
============================================================

For a successful scrape:

1. Validate decrypted data.
2. Insert price_history.
3. Update tracked_products.last_scraped_at.
4. Insert SUCCESS scrape log.

If practical, use a database transaction so successful scrape state remains consistent.

Do not update last_scraped_at before successful price_history insertion.

If database insertion fails:

The scrape should be considered unsuccessful from the backend perspective.

Do not claim success if database persistence failed.

============================================================
32. SCHEDULING
============================================================

The scraper should run approximately every 2 hours.

Do not rely only on:

setInterval(...)

because deployment environments can restart.

Instead provide:

POST /api/internal/scrape-all

and configure an external scheduler/cron service to call it every 2 hours.

The endpoint must be authenticated.

Prevent overlapping jobs.

If a previous scrape-all job is still running:

do not start a second full batch.

Return:

409

or a safe "already running" response.

============================================================
33. CONCURRENCY AND RATE LIMITING
============================================================

Do not scrape all products simultaneously.

Use configurable concurrency.

Default:

2

Add small delays between products if necessary.

Respect 429 responses.

On 429:

exponential backoff

plus jitter.

Do not immediately retry hundreds of times.

============================================================
34. RETRY POLICY
============================================================

Centralize retry logic.

Example:

MAX_ATTEMPTS=4

Retry:

- network errors
- timeouts
- 401
- 403
- 408
- 429
- 500
- 502
- 503
- 504
- browser crash
- store UI price failure
- decryption failure where a fresh session may fix it

Potentially do not retry:

- invalid product URL
- product not found
- malformed database record
- unsupported external store URL
- permanent 400-level errors

Use exponential backoff with jitter.

============================================================
35. IMPORTANT: RETRY THE CORRECT SCOPE
============================================================

If:

GET /api/products/{id}/price

returns:

401/403

do NOT just repeatedly request the same price endpoint.

Restart the session flow.

Correct:

new page/context

new challenge

new browser interaction

new session

new price request

This is important because the session token expires and is tied to the challenge flow.

============================================================
36. NO BLACK / ZERO DATA
============================================================

This is a hard requirement.

The backend must never create:

price = 0

stock = 0

because the scraper failed.

0 is valid only when the store genuinely reports:

price = 0

or:

stock = 0

after successful decryption.

Therefore:

if decrypted `s === 0`:

VALID

because it can legitimately mean out of stock.

But:

if `s` is missing:

INVALID

If price is missing:

INVALID

If parsing fails:

INVALID

If request fails:

INVALID

No price_history row.

============================================================
37. OBSERVABILITY
============================================================

Implement structured logging.

Every scrape should produce logs like:

SCRAPE_START
PRODUCT_LOADED
COOKIE_ACCEPTED
PRICE_AREA_HOVERED
REVEAL_CLICKED
CHALLENGE_REQUEST
SESSION_REQUEST
PRICE_REQUEST
PRICE_RESPONSE
DECRYPT_SUCCESS
VALIDATION_SUCCESS
DB_INSERT_SUCCESS
SCRAPE_SUCCESS

or:

SCRAPE_START
COOKIE_ACCEPTED
REVEAL_CLICKED
PRICE_REQUEST
PRICE_RESPONSE 503
RETRY
PRICE_REQUEST
PRICE_RESPONSE 429
RETRY
PRICE_REQUEST
PRICE_RESPONSE 200
DECRYPT_SUCCESS
VALIDATION_SUCCESS
DB_INSERT_SUCCESS
SCRAPE_SUCCESS

Never log secrets.

============================================================
38. ERROR OBJECT
============================================================

Create typed scraper errors.

Example:

ScraperError {
  type,
  message,
  retryable,
  httpStatus,
  productId,
  attempt
}

This makes retry logic easier.

============================================================
39. SECURITY
============================================================

Environment variables:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

or equivalent secure server-side Supabase credentials.

MOCK_STORE_BASE_URL
INTERNAL_CRON_SECRET

MAX_SCRAPE_ATTEMPTS
SCRAPE_CONCURRENCY
SCREENSHOT_ON_FAILURE

Never commit .env.

Create:

.env.example

without real secrets.

Never expose SUPABASE_SERVICE_ROLE_KEY to frontend.

Never expose INTERNAL_CRON_SECRET.

============================================================
40. URL VALIDATION
============================================================

Because this assignment must only scrape INE mock store:

Accept only:

https://demo.inelabteamdev.com/

and paths underneath it.

Reject:

http://random-site.com
https://amazon.com
https://example.com

Do not create a generic web scraper.

============================================================
41. TESTING
============================================================

Create tests for:

1. successful scrape
2. cookie popup absent
3. cookie popup present
4. price hidden
5. reveal button
6. slow price loading
7. 429
8. 500
9. 503
10. 401
11. 403
12. timeout
13. invalid encrypted payload
14. invalid decrypted JSON
15. missing price
16. missing stock
17. stock = 0
18. price = 0 if legitimately returned
19. negative price
20. negative stock
21. duplicate tracked product
22. inactive product
23. one product fails while another succeeds
24. overlapping scrape job
25. browser crash
26. database insertion failure

For external-store tests, use mocked responses where appropriate rather than hammering the actual store.

============================================================
42. DRY RUN / DEBUG MODE
============================================================

Implement:

SCRAPER_DEBUG=true

When enabled:

- headed browser
- verbose logs
- screenshots
- network status logs
- no secret logging

When disabled:

- production-safe logging
- screenshots only on failure if configured
- configurable headless mode

For the assignment demonstration, support:

HEADLESS=false

so the browser is visible.

============================================================
43. ASSIGNMENT DEMO MODE
============================================================

The assignment specifically wants a headed recording demonstrating difficult/slow/failing behavior.

Therefore implement a mode:

DEMO_MODE=true

When enabled:

- browser visible
- slow waits are visible
- retry messages are logged clearly
- screenshots may be enabled
- do not hide failures
- print a clean timeline of what the scraper is doing

Example:

[10:00:01] Opening product
[10:00:02] Cookies accepted
[10:00:03] Hovering price
[10:00:04] Clicking REVEAL PRICE
[10:00:04] Challenge requested
[10:00:05] Session created
[10:00:05] Price request -> 503
[10:00:05] Store retry
[10:00:06] Price request -> 429
[10:00:08] Outer retry scheduled
[10:00:12] New browser attempt
[10:00:15] Price request -> 200
[10:00:15] Decryption successful
[10:00:15] Price ₹4821
[10:00:15] Stock 43
[10:00:15] Database updated
[10:00:15] SUCCESS

============================================================
44. PROJECT STRUCTURE
============================================================

Use a clean structure similar to:

backend/

├── src/
│   ├── server.js
│   │
│   ├── config/
│   │   └── env.js
│   │
│   ├── db/
│   │   └── supabase.js
│   │
│   ├── routes/
│   │   ├── health.routes.js
│   │   ├── product.routes.js
│   │   └── internal.routes.js
│   │
│   ├── controllers/
│   │   ├── product.controller.js
│   │   └── scrape.controller.js
│   │
│   ├── services/
│   │   ├── product.service.js
│   │   ├── history.service.js
│   │   └── scrape.service.js
│   │
│   ├── scraper/
│   │   ├── browser.js
│   │   ├── cookies.js
│   │   ├── product-page.js
│   │   ├── network.js
│   │   ├── session.js
│   │   ├── decrypt.js
│   │   ├── validator.js
│   │   ├── retry.js
│   │   ├── errors.js
│   │   └── index.js
│   │
│   ├── jobs/
│   │   └── scrape-all.job.js
│   │
│   └── utils/
│       ├── logger.js
│       └── sleep.js
│
├── tests/
│
├── screenshots/
│
├── package.json
├── .env.example
├── .gitignore
└── README.md

Keep modules small and focused.

============================================================
45. API RESPONSE FORMAT
============================================================

Use consistent API responses.

Success:

{
  "success": true,
  "data": {}
}

Failure:

{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Price was not available"
  }
}

Do not leak stack traces in production.

============================================================
46. GRACEFUL SHUTDOWN
============================================================

On SIGTERM/SIGINT:

1. stop accepting new scrape jobs
2. wait for active jobs if possible
3. close Playwright browser
4. close resources
5. exit cleanly

Do not leave Chromium processes running.

============================================================
47. IMPORTANT IMPLEMENTATION RULE
============================================================

Do not prematurely optimize.

First make one product work correctly.

Then:

1. single product
2. retries
3. database
4. batch
5. concurrency
6. scheduled endpoint
7. API
8. deployment

Do not create a huge abstraction before verifying the actual store interaction.

============================================================
48. IMPORTANT STORE-SPECIFIC RULE
============================================================

The store's frontend is the authority for the browser security/challenge flow.

Do not invent:

- canvas hash
- WebGL hash
- mouse movement values
- screen dimensions
- hardware concurrency
- animation frame values
- attestation
- session token

Let Playwright execute the actual store frontend.

The Node backend should only process information legitimately generated by the browser session.

============================================================
49. FINAL ACCEPTANCE CRITERIA
============================================================

The backend is complete only when:

[ ] Product can be tracked.

[ ] Product metadata stored in Supabase.

[ ] Product URL validated to INE store.

[ ] Playwright opens actual product.

[ ] Cookies handled safely.

[ ] Price area hovered.

[ ] REVEAL PRICE clicked.

[ ] Store's own challenge flow executes.

[ ] Session token captured without logging it.

[ ] Price API response captured.

[ ] Encrypted payload decrypted correctly.

[ ] Price validated.

[ ] Stock validated.

[ ] Successful observation inserted into price_history.

[ ] last_scraped_at updated only after success.

[ ] Every attempt logged.

[ ] 429 handled.

[ ] 401 handled.

[ ] 403 handled.

[ ] 500 handled.

[ ] 502 handled.

[ ] 503 handled.

[ ] 504 handled.

[ ] Network timeout handled.

[ ] Browser crash handled.

[ ] Decryption failure handled.

[ ] Missing price handled.

[ ] Missing stock handled.

[ ] No fake 0/null values inserted after failures.

[ ] Stock = 0 works as a legitimate successful value.

[ ] One failed product does not stop other products.

[ ] Concurrent scraping is bounded.

[ ] Overlapping scrape-all jobs prevented.

[ ] External cron endpoint protected.

[ ] Manual scrape endpoint protected/controlled.

[ ] Health endpoint available.

[ ] Debug/headed mode available.

[ ] Assignment demo mode available.

[ ] Secrets are never logged.

[ ] Supabase service role key never reaches frontend.

[ ] Graceful shutdown implemented.

[ ] README explains setup, architecture, environment variables,
    scraping workflow, retry strategy, database schema, API endpoints,
    and deployment.

============================================================
50. WHAT I WANT FROM YOU
============================================================

Build the backend completely.

Do not just describe it.

Generate the actual project files/code.

Start by:

1. Showing the final architecture briefly.
2. Creating package.json.
3. Creating .env.example.
4. Creating the server.
5. Creating Supabase connection.
6. Creating scraper modules.
7. Creating retry/error system.
8. Creating decryption module.
9. Creating product APIs.
10. Creating scrape APIs.
11. Creating database services.
12. Creating batch scraper.
13. Creating concurrency handling.
14. Creating tests.
15. Creating README.
16. Explaining exactly how to run locally.
17. Explaining exactly how to test one product.
18. Explaining exactly how to trigger scrape-all.
19. Explaining how to configure the 2-hour external cron.
20. Explaining how to deploy to Render.

Before declaring the implementation complete, review the code for:

- race conditions
- retry bugs
- infinite loops
- duplicate database inserts
- secret leakage
- browser leaks
- Chromium process leaks
- invalid data insertion
- null/zero fallback bugs
- overlapping scrape jobs
- unhandled promises
- database failures
- malformed API responses
- expired session tokens
- 429 handling
- 5xx handling
- browser timeouts

The final implementation must be robust enough to demonstrate the assignment's difficult scraping behavior rather than only succeeding when the store is perfectly healthy.