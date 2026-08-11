/**
 * Machine-readable booking domain errors. `code` is what API routes map to
 * an HTTP status and what clients key off of to show a translated message
 * (see messages/*.json `errors.*`) — never parse `message`, it's
 * English-only debugging text.
 */
export type BookingErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_GUEST_COUNT"
  | "SERVICE_NOT_BOOKABLE"
  | "INVALID_DATE"
  | "SLOT_IN_PAST"
  | "SLOT_UNAVAILABLE"
  | "INVALID_CUSTOMER_DETAILS"
  | "HOLD_NOT_FOUND"
  | "HOLD_EXPIRED"
  | "RESERVATION_NOT_FOUND"
  | "FORBIDDEN";

const STATUS_BY_CODE: Record<BookingErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_GUEST_COUNT: 400,
  SERVICE_NOT_BOOKABLE: 400,
  INVALID_DATE: 400,
  SLOT_IN_PAST: 409,
  SLOT_UNAVAILABLE: 409,
  INVALID_CUSTOMER_DETAILS: 400,
  HOLD_NOT_FOUND: 404,
  HOLD_EXPIRED: 409,
  RESERVATION_NOT_FOUND: 404,
  FORBIDDEN: 403,
};

export class BookingError extends Error {
  readonly code: BookingErrorCode;
  readonly httpStatus: number;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
  }
}
