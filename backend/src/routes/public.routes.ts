import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPublicEvent, preRegister } from "../controllers/public.controller";

const router = Router();

// No login here, so these are rate limited per IP address. The limit is
// generous because a whole campus can share one public IP at an event.
const viewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registrations from this network. Please try again in a few minutes." },
});

router.get("/events/:token", viewLimiter, getPublicEvent);
router.post("/events/:token/pre-register", registerLimiter, preRegister);

export default router;
