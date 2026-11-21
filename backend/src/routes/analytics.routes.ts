import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { analyticsOverview } from "../controllers/analytics.controller";

const router = Router();

// Admin and MedTech only. Super Admin has no access to analytics.
router.use(authenticate, requireRole("ADMIN", "MEDTECH"));
router.get("/overview", analyticsOverview);

export default router;
