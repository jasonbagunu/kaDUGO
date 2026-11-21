import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import {
  addUnitActivity, changeUnitStatus, getBloodUnit, issueUnit, listBloodUnits, recordTest, updateUnitStorage,
} from "../controllers/bloodUnits.controller";

const router = Router();

// Blood units, testing and traceability belong to the blood-center staff
// (Admin and MedTech). Super Admin has no access.
router.use(authenticate, requireRole("ADMIN", "MEDTECH"));

// There is deliberately no "create unit" or "delete unit" route: a unit is
// created automatically when a donation is recorded, and is never deleted, so
// every unit stays traceable back to its donor and donation.
router.get("/", listBloodUnits);
router.get("/:id", getBloodUnit);
router.post("/:id/tests", recordTest);
router.patch("/:id/status", changeUnitStatus);
router.patch("/:id/storage", updateUnitStorage);
router.post("/:id/activities", addUnitActivity);
router.post("/:id/issue", issueUnit);

export default router;
