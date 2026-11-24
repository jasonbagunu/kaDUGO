import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { logAudit } from "../lib/audit";
import { emailSchema, nameSchema, passwordSchema } from "../lib/userSchemas";
import { REVEAL_SECONDS, signRevealToken } from "../lib/reveal";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
} as const;

// Compared against when the username does not exist, so a wrong username takes
// as long to reject as a wrong password (stops attackers guessing which
// usernames exist by timing the response).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export const login = asyncHandler(async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const identifier = username.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    await logAudit(prisma, {
      userId: user?.id ?? null,
      userName: user?.name ?? identifier,
      userRole: user?.role ?? null,
      action: "Failed Login",
      details: "Incorrect username or password",
      ipAddress: req.ip,
    });
    throw new AppError(401, "Incorrect username or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "This account has been deactivated. Contact your administrator to restore access.");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect,
  });

  await logAudit(prisma, {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: "User Login",
    details: "Signed in successfully",
    ipAddress: req.ip,
  });

  const token = jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

  res.json({ token, user: updated });
});

// Returns the account behind the current token (used to restore a session).
export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: publicUserSelect,
  });
  res.json({ user });
});

// Lets any signed-in user change their own password.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const actor = req.user!;

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Password Changed",
      details: "Changed own password",
      ipAddress: req.ip,
    });
  });

  res.json({ message: "Password updated." });
});

const updateMeSchema = z
  .object({ name: nameSchema.optional(), email: emailSchema.optional() })
  .refine((d) => d.name !== undefined || d.email !== undefined, { message: "Send a name and/or email to update." });

// Lets any signed-in user edit their own name and email. The username and
// role can only be changed by the administrator who manages the account.
export const updateMe = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateMeSchema.parse(req.body);

  if (data.email) {
    const clash = await prisma.user.findFirst({
      where: { email: data.email, id: { not: actor.id } },
      select: { id: true },
    });
    if (clash) throw new AppError(409, `The email "${data.email}" is already used by another account.`);
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: actor.id },
      data: { name: data.name, email: data.email },
      select: publicUserSelect,
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: updated.name,
      userRole: actor.role,
      action: "Profile Updated",
      details: `Updated own profile: ${Object.keys(data).join(", ")}`,
      ipAddress: req.ip,
    });
    return updated;
  });

  res.json({ user });
});

const reauthSchema = z.object({ password: z.string().min(1, "Enter your password.") });

// Asks the signed-in person for their password again before they may see
// sensitive donor information. A correct password returns a token that is
// valid for a few minutes; a wrong one is recorded in the audit log.
export const reauthenticate = asyncHandler(async (req, res) => {
  const { password } = reauthSchema.parse(req.body);
  const actor = req.user!;

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await logAudit(prisma, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "Failed Password Confirmation",
      details: "Incorrect password when asking to view sensitive information",
      ipAddress: req.ip,
    });
    throw new AppError(401, "Incorrect password.");
  }

  res.json({ revealToken: signRevealToken(actor.id), expiresInSeconds: REVEAL_SECONDS });
});
