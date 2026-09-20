import { Router } from "express";
import { historyController } from "../controllers/historyController.js";

const router = Router();

router.get("/:id", historyController.getHistory);

export default router;
