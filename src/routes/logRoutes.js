import { Router } from "express";
import { logController } from "../controllers/logController.js";

const router = Router();

router.get("/:id", logController.getLogs);

export default router;
