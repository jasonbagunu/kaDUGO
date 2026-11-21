import { z } from "zod";
import type { DonationEvent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { dateString, fromDbDate, toDbDate } from "../lib/dates";
import { EVENT_STATUS_LABEL, bloodTypeInput, sexInput } from "../lib/labels";

// Everything here is open to the public (no login), so it only ever returns
// what the registration page needs, never internal records.

const preRegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
  dob: dateString.refine((s) => toDbDate(s).getTime() <= Date.now(), "Date of birth cannot be in the future."),
  sex: sexInput,
  contact: z
    .string()
    .trim()
    .min(7, "Enter a valid contact number.")
    .max(20, "Enter a valid contact number.")
    .regex(/^[0-9+()\-\s]+$/, "Enter a valid contact number."),
  email: z
    .string()
    .trim()
    .max(150, "Email is too long.")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address.")
    .default(""),
  address: z.string().trim().min(1, "Enter your home address.").max(255, "Address is too long."),
  // "Blood type (if known)": an empty choice means unknown.
  bloodType: z.preprocess((v) => (v === "" || v === null ? undefined : v), bloodTypeInput.optional()),
});

const acceptsRegistrations = (e: DonationEvent) =>
  e.registrationOpen && (e.status === "UPCOMING" || e.status === "ONGOING");

function publicEvent(e: DonationEvent) {
  return {
    name: e.name,
    date: fromDbDate(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
    location: e.location,
    description: e.description,
    organizer: e.organizer,
    contact: e.contact,
    status: EVENT_STATUS_LABEL[e.status],
    acceptingRegistrations: acceptsRegistrations(e),
  };
}

async function findEventByToken(token: string) {
  const event = await prisma.donationEvent.findUnique({ where: { publicToken: token } });
  if (!event) throw new AppError(404, "This registration link is not valid.");
  return event;
}

export const getPublicEvent = asyncHandler(async (req, res) => {
  const event = await findEventByToken(String(req.params.token));
  res.json({ event: publicEvent(event) });
});

export const preRegister = asyncHandler(async (req, res) => {
  const event = await findEventByToken(String(req.params.token));
  if (!acceptsRegistrations(event)) {
    throw new AppError(403, "Registration for this event is closed.");
  }

  const data = preRegisterSchema.parse(req.body);

  // Stops the same person submitting the form twice for one event.
  const duplicate = await prisma.preRegistration.findFirst({
    where: { eventId: event.id, contact: data.contact, name: { equals: data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new AppError(409, "You are already pre-registered for this event.");

  const preReg = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "prereg", "PRE-", 5);
    return tx.preRegistration.create({
      data: {
        id,
        eventId: event.id,
        name: data.name,
        dob: toDbDate(data.dob),
        sex: data.sex,
        contact: data.contact,
        email: data.email,
        address: data.address,
        bloodType: data.bloodType,
      },
    });
  });

  res.status(201).json({
    reference: preReg.id,
    name: preReg.name,
    event: publicEvent(event),
  });
});
