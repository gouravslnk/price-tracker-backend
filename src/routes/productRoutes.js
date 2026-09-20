import { Router } from "express";
import { productController } from "../controllers/productController.js";

const router = Router();

// Store Catalog & Search
router.get("/search", productController.search);

// Tracked Products List (both GET / and GET /tracked supported)
router.get("/", productController.getTracked);
router.get("/tracked", productController.getTracked);

// Track / Untrack Product
router.post("/track", productController.trackProduct);
router.delete("/track/:id", productController.untrackProduct);

// Price Observations & Scrape Logs & Manual Scrape (supporting both /history/:id and /:id/history)
router.get("/history/:id", productController.getHistory);
router.get("/:id/history", productController.getHistory);

router.get("/logs/:id", productController.getLogs);
router.get("/:id/scrape-logs", productController.getLogs);

router.post("/scrape/:id", productController.manualScrape);
router.post("/:id/scrape", productController.manualScrape);

// Single Product Store Details
router.get("/details/:id", productController.getById);

// Untrack Product fallback by ID
router.delete("/:id", productController.untrackProduct);

// Single Product Info fallback by ID (must be last)
router.get("/:id", productController.getById);

export default router;
