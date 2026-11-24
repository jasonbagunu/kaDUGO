import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { requireReveal } from "../lib/reveal";
import { createDonor, deleteDonor, getDonor, getDonorSensitive, listDonors, updateDonor } from "../controllers/donors.controller";

const router = Router();

// Donor records belong to the blood-center staff (Admin and MedTech).
// Super Admin is system administration only and has no access here.
router.use(authenticate, requireRole("ADMIN", "MEDTECH"));

router.get("/", listDonors);
router.post("/", createDonor);
router.get("/:id", getDonor);
// Protected details: needs the password confirmation (X-Reveal-Token) as well as a login.
router.get("/:id/sensitive", requireReveal, getDonorSensitive);
router.patch("/:id", updateDonor);
router.delete("/:id", requireRole("ADMIN"), deleteDonor);

export default router;
