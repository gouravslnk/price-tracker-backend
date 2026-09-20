import { Router } from "express";
import { scrapeController } from "../controllers/scrapeController.js";

const router = Router();

router.post("/trigger", scrapeController.triggerAllScrapes);
router.post("/trigger/:id", scrapeController.triggerSingleInternalScrape);

export default router;
