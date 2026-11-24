import bcrypt from "bcrypt";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { emailSchema, nameSchema, passwordSchema, usernameSchema } from "../lib/userSchemas";

// Who may manage whom. Admin -> MedTech only. Super Admin -> Admin and MedTech
// (Super Admin accounts are never managed through the API).
const MANAGEABLE_ROLES: Record<Role, Role[]> = {
  SUPER_ADMIN: ["ADMIN", "MEDTECH"],
  ADMIN: ["MEDTECH"],
  MEDTECH: [],
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEDTECH: "MedTech",
};

// Never include passwordHash in what is sent back.
const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  createdById: true,
} as const;

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "MEDTECH"]);

const createSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
});

const updateSchema = z.object({
  name: nameSchema.optional(),
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(), // only sent when resetting the password
  role: roleSchema.optional(),
});

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

function manageableBy(role: Role): Role[] {
  return MANAGEABLE_ROLES[role];
}

async function assertUnique(fields: { username?: string; email?: string }, excludeId?: string) {
  const or: { username?: string; email?: string }[] = [];
  if (fields.username) or.push({ username: fields.username });
  if (fields.email) or.push({ email: fields.email });
  if (or.length === 0) return;

  const clash = await prisma.user.findFirst({
    where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { username: true, email: true },
  });
  if (!clash) return;
  if (fields.username && clash.username === fields.username) {
    throw new AppError(409, `The username "${fields.username}" is already taken.`);
  }
  throw new AppError(409, `The email "${fields.email}" is already used by another account.`);
}

// Loads a user and makes sure the signed-in person is allowed to manage them.
async function loadManageableUser(id: string, actorRole: Role) {
  const target = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!target) throw new AppError(404, "User not found.");
  if (!manageableBy(actorRole).includes(target.role)) {
    throw new AppError(403, `You are not allowed to manage ${ROLE_LABEL[target.role]} accounts.`);
  }
  return target;
}

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(["ADMIN", "MEDTECH"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(10),
});

// Searchable, filterable and paged. The role filter can only narrow the accounts the
// signed-in person may manage; it can never widen it (an Admin still sees MedTechs only).
export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, page, pageSize } = listQuerySchema.parse(req.query);
  const allowed = manageableBy(req.user!.role);

  const where: Prisma.UserWhereInput = {
    role: { in: role ? allowed.filter((r) => r === role) : allowed },
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total, activeCount, inactiveCount] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: userSelect }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: { in: allowed }, status: "ACTIVE" } }),
    prisma.user.count({ where: { role: { in: allowed }, status: "INACTIVE" } }),
  ]);
  res.json({ users, items: users, total, page, pageSize, activeCount, inactiveCount });
});

// Lets the Add/Edit form warn while typing: is this username or email already used by any account?
// Only "taken or not" is returned, never whose account it is.
export const checkAvailability = asyncHandler(async (req, res) => {
  const q = z
    .object({
      username: z.string().trim().max(60).optional(),
      email: z.string().trim().max(150).optional(),
      excludeId: z.string().trim().max(30).optional(),
    })
    .parse(req.query);

  const notSelf = q.excludeId ? { id: { not: q.excludeId } } : {};
  const [usernameHit, emailHit] = await Promise.all([
    q.username ? prisma.user.findFirst({ where: { username: q.username.toLowerCase(), ...notSelf }, select: { id: true } }) : null,
    q.email ? prisma.user.findFirst({ where: { email: q.email.toLowerCase(), ...notSelf }, select: { id: true } }) : null,
  ]);
  res.json({ usernameTaken: !!usernameHit, emailTaken: !!emailHit });
});

export const createUser = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = createSchema.parse(req.body);

  if (!manageableBy(actor.role).includes(data.role)) {
    throw new AppError(403, `You are not allowed to create ${ROLE_LABEL[data.role]} accounts.`);
  }
  await assertUnique({ username: data.username, email: data.email });

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "user", "USR-", 3);
    const created = await tx.user.create({
      data: {
        id,
        name: data.name,
        username: data.username,
        email: data.email,
        passwordHash,
        role: data.role,
        createdById: actor.id,
      },
      select: userSelect,
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: "User Created",
      details: `Created ${ROLE_LABEL[data.role]} account for ${data.name} (${id})`,
      ipAddress: req.ip,
    });
    return created;
  });

  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const data = updateSchema.parse(req.body);
  const target = await loadManageableUser(String(req.params.id), actor.role);

  if (data.role && !manageableBy(actor.role).includes(data.role)) {
    throw new AppError(403, `You are not allowed to assign the ${ROLE_LABEL[data.role]} role.`);
  }
  await assertUnique({ username: data.username, email: data.email }, target.id);

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: target.id },
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        role: data.role,
        passwordHash,
      },
      select: userSelect,
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: data.password ? "Password Reset" : "User Updated",
      details: data.password
        ? `Reset the password for ${updated.name} (${updated.id})`
        : `Updated account details for ${updated.name} (${updated.id})`,
      ipAddress: req.ip,
    });
    return updated;
  });

  res.json({ user });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const { status } = statusSchema.parse(req.body);
  const target = await loadManageableUser(String(req.params.id), actor.role);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { status },
      select: userSelect,
    });
    await logAudit(tx, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: status === "ACTIVE" ? "User Activated" : "User Deactivated",
      details: `${status === "ACTIVE" ? "Activated" : "Deactivated"} account for ${updated.name} (${updated.id})`,
      ipAddress: req.ip,
    });
    return updated;
  });

  res.json({ user });
});
