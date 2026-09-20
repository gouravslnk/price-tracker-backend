import { Router } from "express";
import { scrapeController } from "../controllers/scrapeController.js";
import { cronAuth } from "../middlewares/cronAuth.js";

const router = Router();

router.post("/trigger", cronAuth, scrapeController.triggerAllScrapes);
router.post("/trigger/:id", scrapeController.triggerSingleInternalScrape);

export default router;
