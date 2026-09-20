# INE Product Price Tracker — Production Express Backend & Scraper API

Production-grade Node.js/Express backend API and Playwright browser automation scraper built for the INE Product Price Tracker assignment.

---

## 🔗 Assignment Deliverables & Live Links

- **Hosted Web App (Frontend)**: [https://price-tracker-frontend-gray.vercel.app](https://price-tracker-frontend-gray.vercel.app)
- **Hosted REST API (Backend)**: [https://price-tracker-backend-352r.onrender.com](https://price-tracker-backend-352r.onrender.com)
- **Headed Scraper Demo Recording**: [Google Drive Video Demo](https://drive.google.com/file/d/1-X1a9-u7oqQ_UsXIBzuHLADjCHcQbITA/view?usp=sharing)
- **Target Mock Store**: [https://demo.inelabteamdev.com](https://demo.inelabteamdev.com)

---

## 🛠️ Technology Stack & Architecture

- **Backend Framework**: Express.js (Node.js ES Modules)
- **Scraper Engine**: Playwright Chromium
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`)
- **Crypto & Security**: Node.js `crypto` (XOR Decryption, SHA-256 key derivation)
- **Deployment**: Render Web Service

### Hybrid / Browser-First Scraping Architecture
1. **Playwright Chromium**: Opens target product page (`https://demo.inelabteamdev.com/product/:id`).
2. **Interactive Flow**: Accepts cookie banner, hovers over price area (dwelling > 600ms), and clicks **REVEAL PRICE**.
3. **Browser Security Execution**: Allows the store's frontend JavaScript to execute WASM proof-of-work, call `GET /api/challenge`, create a session token via `POST /api/session`, and request encrypted price payload `GET /api/products/:id/price`.
4. **Network Interception & XOR Decryption**: Intercepts the response token and encrypted `e` payload, decrypts using SHA-256 derived key `SHA256("ine-mock-store-shared-k3y|enc|" + token)`, and strictly validates numeric price and integer stock.
5. **Database Persistence**: Successful observations are recorded in `price_history` and `last_scraped_at` is updated. Every attempt (SUCCESS, RETRY, FAILED) is honestly recorded in `scrape_logs`.

---

## 📁 Project Structure

```
price-tracker-backend/
├── .env                       # Local Environment Variables
├── .env.example               # Environment Variables Reference
├── render.yaml                # Render Deployment Manifest
├── package.json
├── README.md
├── scripts/
│   └── headed-run.js          # Headed Browser Scraper Demo Script
├── src/
│   ├── app.js                 # Express Application & Middleware Setup
│   ├── server.js              # HTTP Server Entry Point & Graceful Shutdown
│   ├── config/
│   │   └── env.js             # Environment Config & Timeout Defaults
│   ├── controllers/
│   │   ├── productController.js # Product Catalog & Tracking Controllers
│   │   └── scrapeController.js  # Scheduled Cron & Manual Scrape Trigger Controller
│   ├── middlewares/
│   │   ├── cronAuth.js        # Internal Cron Secret Authentication Guard
│   │   ├── errorHandler.js    # Centralized JSON Error Handler
│   │   └── requestLogger.js   # HTTP Request Logging Middleware
│   ├── routes/
│   │   ├── productRoutes.js   # REST API Endpoints (/api/products/*)
│   │   ├── internalRoutes.js  # Cron Endpoints (/api/internal/*)
│   │   ├── trackingRoutes.js  # Backward-compatibility alias (/api/tracking)
│   │   ├── historyRoutes.js   # Backward-compatibility alias (/api/history)
│   │   ├── logRoutes.js       # Backward-compatibility alias (/api/logs)
│   │   └── scrapeRoutes.js    # Backward-compatibility alias (/api/scrape)
│   ├── scraper/
│   │   ├── browser.js         # Playwright Chromium Lifecycle & Context Manager
│   │   ├── cookies.js         # Cookie Consent Handler
│   │   ├── decrypt.js         # XOR Base64 Decryption Module
│   │   ├── errors.js          # ScraperError & Error Category Definitions
│   │   ├── network.js         # Response Interceptor for Token & Encrypted Payload
│   │   ├── product-page.js    # Navigation, Hover & Reveal Button Automation
│   │   ├── retry.js           # Exponential Backoff with Jitter & Screenshot Capture
│   │   ├── validator.js       # Strict Price/Stock Validation & INE URL Restrictions
│   │   └── index.js           # Core Scraper Orchestrator & Worker Pool Queue
│   ├── services/
│   │   ├── cryptoService.js   # Helper crypto utilities
│   │   ├── mockStoreApi.js    # Mock Store Catalog Search Service
│   │   ├── scraper.js         # Re-export facade for scraper
│   │   └── supabase.js        # Supabase PostgreSQL Client & Queries
│   └── utils/
│       └── logger.js          # Structured JSON Logger
└── tests/
    ├── api.test.js            # Express Route & Auth Security Tests
    ├── decrypt.test.js        # Payload Decryption Tests
    └── validator.test.js      # Price/Stock Validation & URL Restriction Tests
```

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `5000` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `SUPABASE_URL` | Supabase Project URL | *Required* |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | *Required* |
| `MOCK_STORE_URL` | INE Mock Store URL | `https://demo.inelabteamdev.com` |
| `INTERNAL_CRON_SECRET` | Secret key protecting `/api/internal/*` | `your-secure-cron-secret-key` |
| `MAX_SCRAPE_ATTEMPTS` | Maximum outer scraper retries | `4` |
| `SCRAPE_CONCURRENCY` | Worker pool concurrency for batch scrapes | `2` |
| `SCREENSHOT_ON_FAILURE` | Capture screenshot to `screenshots/` on failure | `true` |
| `SCRAPER_DEBUG` | Verbose debug logging | `false` |
| `DEMO_MODE` | Observable timeline logging for assignment video | `false` |
| `HEADLESS` | Playwright browser mode | `true` |

---

## 🚀 Setup & Execution

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and insert your Supabase credentials:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Run Headed Scraper Mode (For Video Recording Demo)
Run the scraper with visible Chromium UI to observe hover interactions, price reveal button clicks, and retry handling:
```bash
npm run scrape:headed
```

---

## 🌐 API Reference

### Health Check
- **`GET /health`**
  ```json
  {
    "status": "ok",
    "service": "ine-price-tracker-backend",
    "timestamp": "2026-09-20T15:30:00.000Z"
  }
  ```

### Tracked Products
- **`GET /api/products/tracked`**
  - Returns active tracked products with latest price, MRP, stock, and currency.
- **`POST /api/products/track`**
  - Request Body: `{ "storeProductId": "274", "name": "...", "url": "https://demo.inelabteamdev.com/product/274" }`
  - Validates that URL belongs to INE mock store. Returns existing product if already tracked.
- **`DELETE /api/products/:id`**
  - Deactivates tracking for product.

### Price History & Scrape Logs
- **`GET /api/products/:id/history`**
  - Returns historical price observations ordered by `scraped_at DESC`.
- **`GET /api/products/:id/scrape-logs`**
  - Returns per-attempt logs with status (`SUCCESS`, `RETRY`, `FAILED`), HTTP status, error message, and duration.

### Manual & Scheduled Scrape Triggers
- **`POST /api/products/:id/scrape`**
  - Manually trigger an immediate scrape for a single product.
- **`POST /api/internal/scrape-all`**
  - Protected by `Authorization: Bearer <INTERNAL_CRON_SECRET>`.
  - Triggers batch scrape across all active products. Returns `409 Conflict` if a batch scrape is already running.
- **`POST /api/internal/scrape/:productId`**
  - Protected by `Authorization: Bearer <INTERNAL_CRON_SECRET>`.
  - Triggers single product scrape for internal testing.

---

## ⏰ 2-Hour Cron Scheduling Configuration

To execute periodic price scraping every 2 hours without relying on unstable `setInterval`:
1. Deploy backend service to Render or your server.
2. Use an external cron service (such as [cron-job.org](https://cron-job.org) or Render Cron Jobs).
3. Configure target URL: `POST https://your-backend.onrender.com/api/internal/scrape-all`
4. Set schedule: Every 2 hours (`0 */2 * * *`).
5. Add HTTP Header: `Authorization: Bearer <INTERNAL_CRON_SECRET>`.

---

## ☁️ Render Deployment

1. Connect repository to Render.
2. Render automatically detects [`render.yaml`](file:///c:/Users/itsga/Desktop/iNE/price-tracker-backend/render.yaml).
3. Set environment variables on Render: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_CRON_SECRET`.
4. Deploy web service.
