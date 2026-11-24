import { z } from "zod";
import type { DonationEvent, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { nextId } from "../lib/ids";
import { dateString, fromDbDate, toDbDate } from "../lib/dates";
import { EVENT_STATUS_LABEL, bloodTypeInput, sexInput } from "../lib/labels";
import { optionalEmail, phMobile } from "../lib/validators";
import { addressInputSchema, resolveAddress } from "../lib/address";
import { DONOR_AGE, ageOn, checkAge, eligibilityForDonors } from "../lib/eligibility";
import { dedupeKey } from "../lib/donorMatch";

// Everything here is open to the public (no login), so it only ever returns
// what the registration page needs, never internal records.

const preRegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
  dob: dateString.refine((s) => toDbDate(s).getTime() <= Date.now(), "Date of birth cannot be in the future."),
  sex: sexInput,
  contact: phMobile,
  email: optionalEmail.optional(),
  address: addressInputSchema,
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
    facebookUrl: e.facebookUrl,
    messengerUrl: e.messengerUrl,
    contactEmail: e.contactEmail,
    otherPlatforms: e.otherPlatforms,
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

  // Age: the public form cannot grant the physician exception, so people outside 16-65 are
  // asked to contact the blood center.
  const age = ageOn(data.dob);
  if (age < DONOR_AGE.min || age > DONOR_AGE.max) {
    throw new AppError(400, `Online registration is for donors aged ${DONOR_AGE.min} to ${DONOR_AGE.max}. Please contact the blood center${event.contact ? ` (${event.contact})` : ""} so a physician can assess you.`);
  }

  // Waiting time: a returning donor who gave blood too recently cannot sign up yet.
  // Only an exact match of name, birth date and mobile number is used, so nothing about
  // other people can be discovered through this form.
  const known = await prisma.donor.findFirst({
    where: { dob: toDbDate(data.dob), contact: data.contact, name: { equals: data.name, mode: "insensitive" } },
  });
  if (known) {
    const eligibility = (await eligibilityForDonors([known])).get(known.id)!;
    if (!eligibility.eligible) {
      throw new AppError(409, eligibility.reason ?? "You are not eligible to donate right now.", {
        code: "NOT_ELIGIBLE",
        nextEligibleDate: eligibility.nextEligibleDate,
      });
    }
  }

  const { address, details } = resolveAddress(data.address);
  const key = dedupeKey(data.name, data.dob);

  // Stops the same person submitting the form twice for one event. The database also
  // enforces this (unique event + name + birth date), so two clicks at once cannot slip through.
  const duplicate = await prisma.preRegistration.findFirst({
    where: {
      eventId: event.id,
      OR: [
        { dedupeKey: key },
        { contact: data.contact, name: { equals: data.name, mode: "insensitive" } },
      ],
    },
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
        email: data.email ?? "",
        address,
        addressDetails: details as unknown as Prisma.InputJsonValue,
        dedupeKey: key,
        bloodType: data.bloodType,
      },
    });
  });

  res.status(201).json({
    reference: preReg.id,
    needsParentalConsent: checkAge(age).needsParentalConsent,
    name: preReg.name,
    event: publicEvent(event),
  });
});
