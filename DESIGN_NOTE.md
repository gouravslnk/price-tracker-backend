# Backend & Scraper Technical Design Note

**Project**: INE Product Price Tracker — Backend API & Automated Scraper  
**Author**: Gourav Solanki  
**Role**: Software Engineer Intern Assessment  
**Repository**: [https://github.com/gouravslnk/price-tracker-backend](https://github.com/gouravslnk/price-tracker-backend)  
**Live API**: [https://price-tracker-backend-352r.onrender.com](https://price-tracker-backend-352r.onrender.com)  

---

## 1. How We Made the Scraping Reliable

The INE mock storefront (`demo.inelabteamdev.com`) simulates realistic real-world scraping hurdles: client-side mouse-movement challenges, WebAssembly attestation, dynamic anti-bot intervals, ephemeral session encryption, and upstream network chaos (random `503`, `429`, and `401` errors).

### A. Hybrid Architecture: Headed/Headless Browser + Network Interception
- **Challenge**: Relying purely on DOM text parsing (`page.innerText('#price')`) suffers from UI rendering lag, client-side re-renders, and hydration delays.
- **Solution**: We deployed **Playwright Chromium** to execute the page's compiled JavaScript (`index-B9UiQq4X.js`) and WASM challenge solver, while attaching a background **Network Response Interceptor** (`page.on('response', ...)`).
- **Decryption on Arrival**: The instant the store retrieves the encrypted payload `GET /api/products/:id/price` and session token `POST /api/session`, we intercept and decrypt the payload directly using our derived XOR decryption algorithm `SHA256("ine-mock-store-shared-k3y|enc|" + token)`. This eliminates UI race conditions completely.

### B. Reverse-Engineering Client Anti-Bot Throttling
- The store's compiled script enforces strict human-interaction heuristics:
  1. Dwell time $\ge 600\text{ms}$ before reveal.
  2. Number of mouse movements $\ge 8$.
  3. Minimum interval between movement timestamps $\ge 40\text{ms}$ (`kr = 40`).
- We implemented `hoverPriceArea` to trace a 12-point stepped mouse curve with **55ms delays** (> 40ms ceiling) and **720ms dwell time**, reliably enabling the **"REVEAL PRICE"** button on the first attempt without triggering anti-bot discards.

### C. Multi-Layered Retry & Backoff Strategy
1. **Store Internal Layer**: The mock store frontend has built-in retry logic (up to 6 attempts). Our scraper awaits in 500ms intervals until the challenge resolves or the store signals hard failure.
2. **Outer Layer**: If a page context hits an unrecoverable timeout or rate limit (`429`), the scraper captures a diagnostic screenshot to `/screenshots`, terminates the browser context, and creates a fresh isolated context with jittered exponential backoff ($2^{\text{attempt}} \times 1000\text{ms} + \text{jitter}$).

### D. Strict Data Integrity
- Every scraped quote is validated before database insertion:
  - `price > 0` (finite numeric value).
  - `stock >= 0` (integer; `0` maps cleanly to `OUT OF STOCK`).
- Failed scrapes are honestly logged to `scrape_logs` with HTTP status, attempt duration, and error codes, and **never** overwrite existing historical prices with corrupt or empty data.

---

## 2. Backend Engineering Trade-offs

| Decision | Trade-off Chosen | Rationale |
| :--- | :--- | :--- |
| **Playwright vs. Pure HTTP (`axios`/`fetch`)** | Browser Automation + Network Interception | The store requires client-side WASM execution, session challenge handshakes, and cookie state that pure HTTP requests cannot solve alone. |
| **Concurrency Ceiling (`SCRAPE_CONCURRENCY=1`)** | Sequential 1-by-1 worker queue with 500ms cool-off | Free-tier cloud hosting (Render) provides 512MB RAM. Concurrently launching multiple Chromium instances triggers Out-Of-Memory crashes. Sequential execution guarantees 100% stability. |
| **External Cron (`cron-job.org`) vs. In-Memory `setInterval`** | External Webhook + Keep-Warm Ping | Cloud containers sleep after 15 minutes of inactivity. An external cron triggers `POST /api/internal/scrape-all` every 2 hours with `CRON_SECRET` authorization, waking the server on demand. |
| **Hybrid Browser Mode** | Local Headed (`localhost`) + Cloud Headless (`Render`) | Allows visual inspection and screen recordings on local developer machines while automatically enforcing `headless: true` on Linux cloud containers without display servers. |

---

## 3. What AI Tools Got Wrong on the First Attempt & How We Fixed It

### 1. Rapid Mouse Movement Throttling Trap
- **What AI Generated**: Standard `page.hover('#reveal-button')` or a tight `for` loop moving the mouse with `10ms` delays.
- **Why It Failed**: The mock store's compiled bundle discards mouse events spaced closer than `40ms`. Fast loops resulted in only 1 recorded movement, leaving the button permanently disabled.
- **How We Fixed It**: Decompiled `index-B9UiQq4X.js`, identified `kr = 40`, and implemented calibrated 55ms sleep intervals across 12 distinct coordinate points.

### 2. XOR Decryption Key Derivation
- **What AI Generated**: Generic AES-256 decryption or plain-text XOR with the static key.
- **Why It Failed**: The store dynamically hashes the combination of a static secret key prefix and the ephemeral session token using SHA-256.
- **How We Fixed It**: Reverse-engineered the exact key schedule and byte-level XOR loop in `decrypt.js`, achieving 100% decryption accuracy without DOM dependency.

### 3. Rootless Playwright Installation on Render
- **What AI Generated**: Added `npx playwright install --with-deps chromium` in build commands.
- **Why It Failed**: Rootless cloud containers disallow `sudo apt-get`, causing the entire build pipeline to fail.
- **How We Fixed It**: Configured standard `npx playwright install chromium` with `PLAYWRIGHT_BROWSERS_PATH=0` and Linux flags (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`).
