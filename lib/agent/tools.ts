import { getTranslations } from "next-intl/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getBookableServices, getServiceOption } from "@/data/services";
import { getAvailableSlotsForDate } from "@/lib/booking/availabilityService";
import { calculateTotalAmount } from "@/lib/booking/pricing";
import { validateReservationHoldRequest, DATE_KEY_PATTERN } from "@/lib/booking/validation";
import { BookingError } from "@/lib/booking/errors";
import { notifyReservationRequestReceived } from "@/lib/booking/reservationNotifications";
import { toPublicReservation } from "@/lib/booking/publicReservation";
import {
  createHold as createHoldRecord,
  submitReservationRequest,
  getByReservationNumber,
} from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { createHandoff, type AgentHandoffInput } from "@/lib/repositories/agentHandoffRepository";
import type { AppLocale } from "@/i18n/routing";
import type { TimeSlot } from "@/types/booking";

/**
 * Customer-facing Gemini agent tool layer. Every function here is a thin
 * wrapper around the exact same domain functions/repositories the
 * customer Booking Wizard and admin dashboard use — booking rules are
 * never reimplemented here, and nothing here touches lib/db or a
 * repository's SQL directly.
 *
 * This is the customer-agent trust boundary — deliberately narrower than
 * lib/repositories/reservationRepository.ts itself, which also exposes
 * confirmReservation() (deposit-based confirm, part of an older proposal
 * path — never called from here) and updateStatus() (admin-only, used by
 * app/admin/actions.ts). Current real policy (README.md, app/admin/
 * actions.ts): no deposit, no online payment, and a submitted request
 * always lands as PENDING — only an admin can move it to CONFIRMED. This
 * file must never call confirmReservation, updateStatus, softDeleteReservation,
 * or any notification other than the "request received" one triggered by
 * a successful createReservationRequest.
 *
 * Deliberately absent — and therefore impossible for the agent to do
 * (see docs/task spec §9):
 *   - confirmReservation / forceCreateReservation: no such tool is
 *     declared or dispatched; createReservationRequest always produces
 *     PENDING via submitReservationRequest(), never confirmReservation().
 *   - arbitrary discounts or price overrides: calculatePrice() always
 *     derives from data/services.ts via lib/booking/pricing.ts.
 *   - refunds, deleteReservation, modifyAnotherReservation,
 *     openBlockedTime, modifyBusinessHours: no such tools exist here.
 *   - sendConfirmationEmail: createReservationRequest only ever triggers
 *     RESERVATION_REQUEST_RECEIVED, never RESERVATION_CONFIRMED — that
 *     email is admin-composed and hand-sent (app/admin/reservations/[id]).
 *   - reading another customer's reservation: getReservationStatus()
 *     requires an identity match (email or phone on file), unlike the
 *     plain-lookup public API used right after a customer's own booking.
 *   - direct database writes: every tool goes through a repository.
 */

const MIN_GUEST_COUNT = 1;
const MAX_GUEST_COUNT = 4;

function assertValidPartySize(partySize: unknown): number {
  const guestCount = Number(partySize);
  if (!Number.isInteger(guestCount) || guestCount < MIN_GUEST_COUNT || guestCount > MAX_GUEST_COUNT) {
    throw new BookingError("INVALID_GUEST_COUNT", "Guest count must be an integer between 1 and 4.");
  }
  return guestCount;
}

function requireServiceOption(serviceOptionId: unknown) {
  const option = getServiceOption(String(serviceOptionId ?? ""));
  if (!option) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }
  return option;
}

export interface AgentServiceOption {
  serviceId: string;
  serviceOptionId: string;
  name: string;
  description: string;
  durationMinutes: number;
  pricePerPerson: number;
  recommended: boolean;
}

/**
 * Every currently bookable treatment option, flattened to one entry per
 * duration/price combination (data/services.ts nests options under a
 * service; every other tool here keys off the flat `serviceOptionId`, so
 * this is the shape Gemini actually needs). Names/descriptions resolve
 * through the same next-intl `services` namespace the notification emails
 * use (lib/booking/reservationNotifications.ts) — never hardcoded text.
 */
export async function getServices(locale: AppLocale): Promise<AgentServiceOption[]> {
  const t = await getTranslations({ locale, namespace: "services" });
  const result: AgentServiceOption[] = [];
  for (const service of getBookableServices()) {
    for (const option of service.options) {
      result.push({
        serviceId: service.id,
        serviceOptionId: option.id,
        name: t(service.nameKey.replace("services.", "")),
        description: t(service.descriptionKey.replace("services.", "")),
        durationMinutes: option.durationMinutes,
        pricePerPerson: option.pricePerPerson,
        recommended: option.recommended ?? false,
      });
    }
  }
  return result;
}

export interface AgentAvailabilityInput {
  date: string;
  serviceOptionId: string;
  partySize: number;
}

/**
 * Server-authoritative slot list for one service option/date — the same
 * function GET /api/availability calls. Never tell the agent a slot is
 * available without going through this.
 */
export async function getAvailability(input: AgentAvailabilityInput): Promise<TimeSlot[]> {
  const option = requireServiceOption(input.serviceOptionId);
  assertValidPartySize(input.partySize);

  const date = String(input.date ?? "");
  if (!DATE_KEY_PATTERN.test(date)) {
    throw new BookingError("INVALID_DATE", "date must be formatted YYYY-MM-DD.");
  }

  return getAvailableSlotsForDate(date, option.durationMinutes);
}

export interface AgentPriceInput {
  serviceOptionId: string;
  partySize: number;
}

export interface AgentPriceResult {
  pricePerPerson: number;
  totalAmount: number;
}

/**
 * Official price for a service option and guest count. Deliberately omits
 * depositAmount/remainingAmount — those columns still exist on
 * ReservationRecord for the admin/legacy path, but current policy
 * (README.md: "예치금(디파짓)도 없습니다") has no deposit, so the agent must
 * never mention one.
 */
export function calculatePrice(input: AgentPriceInput): AgentPriceResult {
  const option = requireServiceOption(input.serviceOptionId);
  const guestCount = assertValidPartySize(input.partySize);
  return {
    pricePerPerson: option.pricePerPerson,
    totalAmount: calculateTotalAmount(option.pricePerPerson, guestCount),
  };
}

export interface AgentReservationInput {
  serviceOptionId: string;
  partySize: number;
  date: string;
  time: string;
  customerName: string;
  email: string;
  phoneOrWhatsapp: string;
  specialRequest?: string;
  locale: AppLocale;
}

export interface AgentReservationResult {
  reservationNumber: string;
  status: string;
  date: string;
  time: string;
  guestCount: number;
  serviceOptionId: string;
  totalAmount: number;
  customerName: string;
}

/**
 * The only path by which the agent can create a reservation. Composes the
 * same two server-authoritative steps the customer Booking Wizard uses —
 * POST /api/reservation-holds (createHold) then POST /api/reservations
 * (submitReservationRequest) — so the exact same double-checked-
 * availability guarantee applies (see reservationRepository.ts's doc
 * comments on those two functions: each re-validates the slot against the
 * database in a single conditional SQL statement). Always lands as
 * PENDING; never calls confirmReservation. Fires the same
 * RESERVATION_REQUEST_RECEIVED notification the wizard's checkout step
 * does, so a customer gets the same email regardless of which path they
 * booked through.
 *
 * `source` is intentionally not agent-settable: reservations.source has a
 * DB CHECK constraint over a fixed acquisition-channel enum (migrations/
 * 0001_init.sql) that has no "chat"/"AI" value, and adding one would be a
 * new business-tracking decision outside this task's scope — this falls
 * through validateReservationHoldRequest's existing default of "DIRECT".
 */
export async function createReservationRequest(input: AgentReservationInput): Promise<AgentReservationResult> {
  const validated = validateReservationHoldRequest({
    serviceOptionId: input.serviceOptionId,
    guestCount: input.partySize,
    date: input.date,
    time: input.time,
    locale: input.locale,
    customer: {
      name: input.customerName,
      phone: input.phoneOrWhatsapp,
      email: input.email,
      preferredLanguage: input.locale,
      specialRequest: input.specialRequest,
    },
  });

  const { reservation: held } = await createHoldRecord(validated);
  const submitted = await submitReservationRequest({ holdId: held.id });

  // Fire-and-forget, same contract as POST /api/reservations — a
  // notification failure must never affect a reservation that already
  // succeeded.
  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    notifyReservationRequestReceived(submitted).catch((error) => {
      console.error(`[agent/tools] notification trigger failed for ${submitted.reservationNumber}`, error);
    }),
  );

  const pub = await toPublicReservation(submitted);
  return {
    reservationNumber: pub.reservationNumber,
    status: pub.status,
    date: pub.dateKey,
    time: pub.serviceStart,
    guestCount: pub.guestCount,
    serviceOptionId: pub.serviceOptionId,
    totalAmount: pub.totalAmount,
    customerName: pub.customerName,
  };
}

export interface AgentReservationStatusInput {
  reservationNumber: string;
  email?: string;
  phone?: string;
}

export interface AgentReservationStatusResult {
  reservationNumber: string;
  status: string;
  date: string;
  time: string;
  guestCount: number;
  totalAmount: number;
}

/**
 * A reservation number alone is not enough for the agent to read a
 * reservation — `email`/`phone` must match the customer on file, or this
 * throws BookingError("FORBIDDEN", ...). A stranger could type in a
 * guessed or overheard number in a chat, so this is a stricter check than
 * the plain GET /api/reservations/:number endpoint used right after a
 * customer's own booking.
 */
export async function getReservationStatus(
  input: AgentReservationStatusInput,
): Promise<AgentReservationStatusResult> {
  const reservation = await getByReservationNumber(input.reservationNumber);
  if (!reservation) {
    throw new BookingError("RESERVATION_NOT_FOUND", "No reservation with that number was found.");
  }

  const customer = await getCustomerById(reservation.customerId);
  const emailMatches = Boolean(input.email && customer?.email === input.email.trim().toLowerCase());
  const phoneMatches = Boolean(input.phone && customer?.phone === input.phone.trim());
  if (!emailMatches && !phoneMatches) {
    throw new BookingError("FORBIDDEN", "Provided identity does not match this reservation's customer.");
  }

  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.status,
    date: reservation.dateKey,
    time: reservation.serviceStart,
    guestCount: reservation.guestCount,
    totalAmount: reservation.totalAmount,
  };
}

/** The only way the agent can respond to a case it isn't allowed to resolve itself. */
export async function handoffToAdmin(input: AgentHandoffInput) {
  return createHandoff(input);
}
