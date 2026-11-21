import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { createDonation, getDonation, listDonations } from "../controllers/donations.controller";

const router = Router();

router.use(authenticate, requireRole("ADMIN", "MEDTECH"));

router.get("/", listDonations);
router.post("/", createDonation);
router.get("/:id", getDonation);

export default router;
