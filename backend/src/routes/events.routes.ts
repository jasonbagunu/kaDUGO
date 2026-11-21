import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { createEvent, getEvent, listEvents, updateEvent } from "../controllers/events.controller";

const router = Router();

// All three staff roles work with events.
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN", "MEDTECH"));

router.get("/", listEvents);
router.post("/", createEvent);
router.get("/:id", getEvent);
router.patch("/:id", updateEvent);

export default router;
