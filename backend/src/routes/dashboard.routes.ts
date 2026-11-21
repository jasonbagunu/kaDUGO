import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { dashboard } from "../controllers/dashboard.controller";

const router = Router();

// All three roles; the controller decides what each one receives.
router.get("/", authenticate, requireRole("SUPER_ADMIN", "ADMIN", "MEDTECH"), dashboard);

export default router;
