import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { listPreRegistrations, registerDonorFromPreReg, updatePreRegistration } from "../controllers/preRegistrations.controller";

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN", "MEDTECH"));

router.get("/", listPreRegistrations);
router.patch("/:id", updatePreRegistration);

// Creates/links the donor record. Super Admin does not handle donor records.
router.post("/:id/register-donor", requireRole("ADMIN", "MEDTECH"), registerDonorFromPreReg);

export default router;
