import { Router } from "express";
import { trackingController } from "../controllers/trackingController.js";

const router = Router();

router.get("/", trackingController.getTracked);
router.post("/", trackingController.trackProduct);
router.delete("/:id", trackingController.untrackProduct);

export default router;
