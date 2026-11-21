import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { exportBackup } from "../controllers/backup.controller";

const router = Router();

// Super Admin only: backup is a system-administration function.
router.get("/export", authenticate, requireRole("SUPER_ADMIN"), exportBackup);

export default router;
