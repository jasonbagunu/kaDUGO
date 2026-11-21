import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { createUser, listUsers, setUserStatus, updateUser } from "../controllers/users.controller";

const router = Router();

// Super Admin and Admin only. The controller further limits WHICH accounts
// each of them may see and change (Admin: MedTech only).
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));

router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.patch("/:id/status", setUserStatus);

export default router;
