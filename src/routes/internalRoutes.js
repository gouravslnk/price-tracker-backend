import { Router } from "express";
import { scrapeController } from "../controllers/scrapeController.js";
import { cronAuth } from "../middlewares/cronAuth.js";

const router = Router();

// Protect all internal endpoints with CRON_SECRET authorization
router.use(cronAuth);

// Section 24 & 32
router.post("/scrape-all", scrapeController.triggerAllScrapes);
router.post("/scrape/:productId", scrapeController.triggerSingleInternalScrape);

export default router;
