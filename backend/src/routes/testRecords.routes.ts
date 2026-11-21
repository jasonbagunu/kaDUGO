import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { listTestRecords } from "../controllers/testRecords.controller";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "MEDTECH"));
router.get("/", listTestRecords);

export default router;
