import type { AppLocale } from "@/i18n/routing";

/** A bookable treatment category, e.g. Aroma Oil, Hot Stone, Facial. */
export interface Service {
  id: string;
  /** Translation key for the display name, e.g. "services.aromaOil.name" */
  nameKey: string;
  /** Translation key for the short description. */
  descriptionKey: string;
  /** Display ordering on the treatment step. */
  order: number;
  options: ServiceOption[];
}

/** A specific duration/price combination within a Service. */
export interface ServiceOption {
  id: string;
  serviceId: string;
  durationMinutes: number;
  /** Price per person, in KRW. */
  pricePerPerson: number;
  recommended?: boolean;
}

/**
 * A single guest within a reservation. For this MVP every guest in a
 * reservation shares the same service option, but the model already
 * supports per-guest treatment selection for a future release.
 */
export interface Guest {
  id: string;
  serviceOptionId: string;
}

export interface Customer {
  name: string;
  /** Full international phone number, e.g. "+82 10-1234-5678". */
  phone: string;
  email: string;
  /** Language the customer wants to be *contacted* in — independent of the UI locale. */
  preferredLanguage: AppLocale;
  specialRequest?: string;
}

export interface TimeSlot {
  /** "HH:mm" in local (Asia/Seoul) time. */
  time: string;
  available: boolean;
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type BookingSource =
  | "GOOGLE_MAPS"
  | "GOOGLE_SEARCH"
  | "INSTAGRAM"
  | "NAVER"
  | "HOTEL"
  | "DIRECT"
  | "REPEAT";

/**
 * A reservation represents one private group, not one individual
 * treatment. `serviceStart`/`serviceEnd` is the customer-facing
 * treatment window; `blockedStart`/`blockedEnd` additionally reserves
 * the prep/cleanup buffer so no other group can overlap it.
 */
export interface Booking {
  id: string;
  reservationNumber: string;
  guestCount: number;
  guests: Guest[];
  serviceOptionId: string;
  date: string; // "YYYY-MM-DD"
  serviceStart: string; // ISO 8601
  serviceEnd: string; // ISO 8601
  blockedStart: string; // ISO 8601
  blockedEnd: string; // ISO 8601
  customer: Customer;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  source: BookingSource;
  status: BookingStatus;
  locale: AppLocale;
  preferredLanguage: AppLocale;
  createdAt: string; // ISO 8601
}
