import { getBookableServices, getServiceOption } from "@/data/services";
import { getAvailableSlotsForDate } from "@/lib/booking/availabilityService";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount } from "@/lib/booking/pricing";
import { validateReservationHoldRequest } from "@/lib/booking/validation";
import { BookingError } from "@/lib/booking/errors";
import { notifyReservationConfirmed } from "@/lib/booking/notifyReservationConfirmed";
import { toPublicReservation, type PublicReservation } from "@/lib/booking/publicReservation";
import {
  confirmReservation as confirmReservationRecord,
  createHold as createHoldRecord,
  getByReservationNumber,
} from "@/lib/repositories/reservationRepository";
import { getCustomerById } from "@/lib/repositories/customerRepository";
import { createHandoff, type AgentHandoffInput } from "@/lib/repositories/agentHandoffRepository";

/**
 * Agent-facing tool layer (AGENTS.md §16). Every tool here is a thin
 * wrapper around the exact same domain functions/repositories the
 * customer website and admin dashboard use — booking rules are never
 * reimplemented here. A future Gemini Enterprise agent process must only
 * ever call these functions, never touch lib/db or the repositories
 * directly, and never write to the database itself.
 *
 * Deliberately absent — and therefore impossible for the agent to do
 * (AGENTS.md §16.2):
 *   - arbitrary discounts or price overrides: no such tool exists;
 *     calculatePrice() always derives from data/services.ts
 *   - refunds: no payment-mutation tool exists
 *   - forcing open a blocked time: createReservationHold() always re-checks
 *     admin blocks the same way POST /api/reservation-holds does
 *   - reading another customer's reservation: getReservation() requires an
 *     identity match (T11), unlike the plain-lookup public API
 *   - direct database writes: every tool goes through a repository
 */

export function getServices() {
  return getBookableServices();
}

export function getAvailability(date: string, serviceOptionId: string) {
  const option = getServiceOption(serviceOptionId);
  if (!option) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }
  return getAvailableSlotsForDate(date, option.durationMinutes);
}

export function calculatePrice(serviceOptionId: string, guestCount: number) {
  const option = getServiceOption(serviceOptionId);
  if (!option) {
    throw new BookingError("SERVICE_NOT_BOOKABLE", "Unknown or unpublished service option.");
  }
  const totalAmount = calculateTotalAmount(option.pricePerPerson, guestCount);
  const depositAmount = calculateDepositAmount(guestCount);
  return {
    pricePerPerson: option.pricePerPerson,
    totalAmount,
    depositAmount,
    remainingAmount: calculateRemainingAmount(totalAmount, depositAmount),
  };
}

/**
 * Never tells the agent a slot is available without going through this —
 * it performs the same server-side re-validation and atomic conflict check
 * as POST /api/reservation-holds (AGENTS.md §16.3 step 11).
 */
export function createReservationHold(rawRequest: unknown) {
  const request = validateReservationHoldRequest(rawRequest);
  return createHoldRecord(request);
}

export async function confirmReservation(holdId: string, depositTransactionId: string): Promise<PublicReservation> {
  const reservation = confirmReservationRecord({ holdId, depositTransactionId });
  void notifyReservationConfirmed(reservation).catch((error) => {
    console.error(`[agent/confirmReservation] notification trigger failed for ${reservation.reservationNumber}`, error);
  });
  return toPublicReservation(reservation);
}

/**
 * T11: a reservation number alone is not enough for the agent to read a
 * reservation — `identity` must match the email or phone on file for that
 * reservation's customer, or this throws FORBIDDEN. The plain
 * GET /api/reservations/:number endpoint (used by the customer's own
 * confirmation screen right after booking) doesn't require this, since only
 * the booking customer sees that number; the agent is a different,
 * higher-risk trust boundary — a stranger could type in a guessed or
 * overheard number in a chat — so it must prove identity first.
 */
export function getReservation(
  reservationNumber: string,
  identity: { email?: string; phone?: string },
): PublicReservation {
  const reservation = getByReservationNumber(reservationNumber);
  if (!reservation) {
    throw new BookingError("RESERVATION_NOT_FOUND", "No reservation with that number was found.");
  }

  const customer = getCustomerById(reservation.customerId);
  const emailMatches = Boolean(identity.email && customer?.email === identity.email.trim().toLowerCase());
  const phoneMatches = Boolean(identity.phone && customer?.phone === identity.phone.trim());
  if (!emailMatches && !phoneMatches) {
    throw new BookingError("FORBIDDEN", "Provided identity does not match this reservation's customer.");
  }

  return toPublicReservation(reservation);
}

export async function sendConfirmation(reservationNumber: string): Promise<void> {
  const reservation = getByReservationNumber(reservationNumber);
  if (!reservation) {
    throw new BookingError("RESERVATION_NOT_FOUND", "No reservation with that number was found.");
  }
  await notifyReservationConfirmed(reservation);
}

/** AGENTS.md §18 — the only way the agent can respond to a case it isn't allowed to resolve itself. */
export function handoffToAdmin(input: AgentHandoffInput) {
  return createHandoff(input);
}
