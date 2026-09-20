# Technical Design Note & Engineering Trade-offs

**Project**: INE Product Price Tracker (Web Scraping)  
**Author**: Gourav Solanki  
**Role**: Software Engineer Intern Assignment  

---

## 1. How We Made the Scraping Reliable

The INE mock storefront is intentionally engineered with anti-bot friction, unpredictable latency, client-side mouse-movement challenges, and simulated upstream chaos (random `503`, `429`, and `401 unauthorized` responses). To make the scraping reliable across unattended runs, we implemented a multi-layered resilience architecture:

### A. Two-Layer Architecture: Browser Navigation + Network Interception
- Instead of relying solely on fragile DOM element selectors that can change or lag during hydration, we deployed **Playwright Chromium** to execute the page's JavaScript bundle (WASM proof-of-work, challenge solving) while simultaneously setting up a **Network Response Interceptor** (`page.on('response', ...)`).
- As soon as the store's frontend successfully retrieves the encrypted payload `GET /api/products/:id/price` and session token `POST /api/session`, we intercept and decrypt the payload directly using our derived XOR decryption algorithm `SHA256("ine-mock-store-shared-k3y|enc|" + token)`. This prevents UI race conditions where the DOM renders late.

### B. Client Challenge Reverse Engineering
- The store’s client script (`index-B9UiQq4X.js`) requires mouse movements over the price area to satisfy:
  1. Dwell time $\ge 600\text{ms}$
  2. Number of moves $\ge 8$
  3. Minimum interval between movement timestamps $\ge 40\text{ms}$ (`kr = 40`)
- We automated `hoverPriceArea` to perform 12 smooth movement steps spaced by 55ms intervals (> 40ms throttle ceiling) and 720ms dwell time, consistently enabling the **REVEAL PRICE** button on attempt 1.

### C. 2-Tier Failure & Flakiness Handling
1. **Store Internal Layer**: The store UI has built-in retries (up to 6 attempts). If the store's internal retries are progressing, we wait for network resolution.
2. **Outer Layer**: If an entire tab encounters a rate limit (`429`), network crash, or unrecoverable error, the scraper captures a diagnostic screenshot, immediately closes the browser context, and opens a clean, isolated browser context with jittered exponential backoff ($b \cdot 2^{\text{attempt}} + \text{jitter}$).

### D. Strict Data Integrity & Validation
- Prices and stock values are strictly validated before persisting to Supabase PostgreSQL:
  - `price > 0` (non-null, finite number).
  - `stock >= 0` (integer; `0` is valid and mapped to `OUT OF STOCK`).
  - Corrupted or incomplete payloads are rejected with an explicit `ScraperError` and never overwrite last-known good data.

---

## 2. Engineering Trade-offs Made

| Decision / Feature | Trade-off Chosen | Rationale |
| :--- | :--- | :--- |
| **Playwright vs. Pure HTTP Fetching** | Browser Automation + Network Interception | The store employs dynamic WASM challenge verification, cookie checks, and encrypted API responses that require a browser runtime environment. |
| **Sequential Batch Scrapes (`SCRAPE_CONCURRENCY=1`)** | Sequential 1-by-1 processing with 500ms cool-off | Free-tier hosting on Render provides 512 MB RAM. Running multiple concurrent headless browser instances risks OOM crashes. Sequential runs ensure 100% stability. |
| **External Cron (`cron-job.org`) vs. Always-on Timer** | External Cron Service + Keep-Warm Ping | Free-tier cloud instances sleep after 15 minutes of inactivity. An external cron ensures scheduled 2-hour runs trigger reliably regardless of instance sleep state. |
| **UI Polling Optimization** | Adaptive short-interval polling (2s on pending, 8s background) | Avoids overwhelming the backend while providing instantaneous UI updates when a user adds a product. |

---

## 3. What AI Tools Got Wrong on the First Attempt & How We Corrected It

### 1. The 40ms Mouse Movement Throttling Trap
- **What AI Suggested**: Standard Playwright `page.hover('#reveal-button')` or rapid mouse movements in a loop (`for (let i=0; i<10; i++) page.mouse.move(...)` with 10ms delays).
- **Why it Failed**: The store's compiled JavaScript (`Ar` anti-bot tracker) discards any mouse movement event where `timestamp - lastTimestamp < 40ms`. Rapid loops resulted in only 1–2 recorded moves, leaving the reveal button disabled.
- **The Correction**: We reverse-engineered the compiled bundle, found `kr = 40` and `minMoves = 8`, and wrote a stepped movement curve with 55ms delays and 720ms dwell time.

### 2. XOR Decryption Key Derivation Misinterpretation
- **What AI Suggested**: Trying to decrypt the price payload with plain string keys or standard AES.
- **Why it Failed**: The mock store derives its XOR keystream by concatenating a static shared key prefix with the ephemeral session token and hashing with SHA-256 (`SHA256("ine-mock-store-shared-k3y|enc|" + token)`).
- **The Correction**: We extracted the exact byte-wise XOR unpacking routine and SHA-256 key schedule in [`decrypt.js`](file:///c:/Users/itsga/Desktop/iNE/price-tracker-backend/src/scraper/decrypt.js), achieving 100% decryption accuracy.

### 3. Missing Rootless Playwright Dependencies on Cloud Containers
- **What AI Suggested**: Adding `npx playwright install --with-deps chromium` in Render build commands.
- **Why it Failed**: `--with-deps` tries to run `apt-get` as root (`sudo`), which fails on rootless container platforms like Render.
- **The Correction**: Configured standard `npx playwright install chromium` combined with `PLAYWRIGHT_BROWSERS_PATH=0` and Linux flags (`--no-sandbox`, `--disable-dev-shm-usage`) plus automated runtime fallback in [`browser.js`](file:///c:/Users/itsga/Desktop/iNE/price-tracker-backend/src/scraper/browser.js).
