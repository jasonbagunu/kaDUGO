import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";
import { changePassword, login, me, reauthenticate, updateMe } from "../controllers/auth.controller";

const router = Router();

// Slows down password guessing: 20 attempts per 15 minutes per IP address.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait a few minutes and try again." },
});

router.post("/login", loginLimiter, login);
router.get("/me", authenticate, me);
router.patch("/me", authenticate, updateMe);
router.post("/change-password", authenticate, changePassword);
// Password confirmation before viewing sensitive donor details (same attempt limit as login).
router.post("/reauth", authenticate, loginLimiter, reauthenticate);

export default router;
