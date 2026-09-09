import { getService, getServiceOption } from "@/data/services";
import { calculateTotalAmountForGuests } from "./pricing";
import type { BookingDraft } from "@/types/bookingState";
import type { Service, ServiceOption } from "@/types/booking";

type DraftGuestFields = Pick<
  BookingDraft,
  "guestCount" | "sameCourse" | "serviceOptionId" | "otherGuestServiceOptionIds"
>;

/**
 * All guests' resolved service option ids, in guest order — the single
 * place both the client draft (before submission) and the submit payload
 * agree on how "same course" vs "different courses" collapse into one
 * per-guest list. Returns null while the choice is incomplete (guest count
 * unknown, guest 1's option not chosen yet, or — when sameCourse is false —
 * any other guest still unpicked).
 */
export function resolveGuestOptionIds(draft: DraftGuestFields): string[] | null {
  const { guestCount, sameCourse, serviceOptionId, otherGuestServiceOptionIds } = draft;
  if (!guestCount || !serviceOptionId) return null;

  if (sameCourse === false) {
    if (otherGuestServiceOptionIds.length !== guestCount - 1) return null;
    if (otherGuestServiceOptionIds.some((id) => !id)) return null;
    return [serviceOptionId, ...(otherGuestServiceOptionIds as string[])];
  }

  return Array.from({ length: guestCount }, () => serviceOptionId);
}

export interface ResolvedGuestTreatment {
  guestNumber: number;
  option: ServiceOption;
  service: Service;
}

/** Resolves each guest's option id to its Service/ServiceOption — null if any id no longer resolves (e.g. a since-removed service). */
export function resolveGuestTreatments(optionIds: string[]): ResolvedGuestTreatment[] | null {
  const resolved: ResolvedGuestTreatment[] = [];
  for (let i = 0; i < optionIds.length; i += 1) {
    const option = getServiceOption(optionIds[i]);
    const service = option ? getService(option.serviceId) : undefined;
    if (!option || !service) return null;
    resolved.push({ guestNumber: i + 1, option, service });
  }
  return resolved;
}

export function isMixedTreatment(optionIds: string[]): boolean {
  return new Set(optionIds).size > 1;
}

export function totalAmountForGuestOptionIds(optionIds: string[]): number {
  return calculateTotalAmountForGuests(
    optionIds.map((id) => getServiceOption(id)?.pricePerPerson ?? 0),
  );
}
