import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { inventorySummary } from "../controllers/inventory.controller";

const router = Router();

// Admin and MedTech only. Super Admin has no access to blood stock.
router.use(authenticate, requireRole("ADMIN", "MEDTECH"));
router.get("/summary", inventorySummary);

export default router;
