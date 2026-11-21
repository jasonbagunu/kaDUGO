import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { listAuditLogs } from "../controllers/auditLogs.controller";

const router = Router();

// Super Admin only.
router.get("/", authenticate, requireRole("SUPER_ADMIN"), listAuditLogs);

export default router;
