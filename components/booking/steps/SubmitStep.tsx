"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import type { AppLocale } from "@/i18n/routing";

type Status = "processing" | "failed";

interface HoldResponse {
  holdId: string;
  reservationNumber: string;
}

interface ApiErrorBody {
  error?: { code: string; message: string };
}

class BookingClientError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Error codes with a translated steps.errors.<code> message; anything else falls back to "generic". */
const KNOWN_ERROR_CODES = new Set([
  "SLOT_UNAVAILABLE",
  "HOLD_EXPIRED",
  "INVALID_GUEST_COUNT",
  "SERVICE_NOT_BOOKABLE",
  "SLOT_IN_PAST",
  "INVALID_CUSTOMER_DETAILS",
]);

/** Errors that mean "your chosen slot is gone" — retrying the same slot won't help. */
const SLOT_GONE_CODES = new Set(["SLOT_UNAVAILABLE", "HOLD_EXPIRED", "SLOT_IN_PAST"]);

async function readErrorCode(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.code ?? "generic";
}

/**
 * No payment is collected here (AGENTS.md deposit removal) — this step
 * locks the slot with a HOLD, then submits it as a PENDING reservation
 * request. The reservation only becomes CONFIRMED later, once an admin
 * reviews and approves it.
 */
export function SubmitStep() {
  const t = useTranslations("steps.submit");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const { draft, setReservationResult, goNext, goToStep } = useBooking();
  const [status, setStatus] = useState<Status>("processing");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    const { details, guestCount, serviceOptionId, date, time } = draft;
    if (!details || !guestCount || !serviceOptionId || !date || !time) return;
    hasStarted.current = true;

    async function run() {
      try {
        const holdRes = await fetch("/api/reservation-holds", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serviceOptionId,
            guestCount,
            date,
            time,
            locale,
            customer: {
              name: details!.name,
              phone: details!.phone,
              email: details!.email,
              preferredLanguage: details!.preferredLanguage,
              specialRequest: details!.specialRequest || undefined,
            },
          }),
        });
        if (!holdRes.ok) throw new BookingClientError(await readErrorCode(holdRes));
        const hold = (await holdRes.json()) as HoldResponse;

        const submitRes = await fetch("/api/reservations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ holdId: hold.holdId }),
        });
        if (!submitRes.ok) throw new BookingClientError(await readErrorCode(submitRes));

        setReservationResult(hold.reservationNumber);
        goNext();
      } catch (error) {
        setErrorCode(error instanceof BookingClientError ? error.code : "generic");
        setStatus("failed");
      }
    }

    void run();
  }, [draft, goNext, setReservationResult, locale]);

  function retry() {
    hasStarted.current = false;
    setErrorCode(null);
    setStatus("processing");
  }

  const message =
    errorCode && KNOWN_ERROR_CODES.has(errorCode)
      ? tErrors(errorCode as Parameters<typeof tErrors>[0])
      : tErrors("generic");
  const slotIsGone = errorCode !== null && SLOT_GONE_CODES.has(errorCode);

  return (
    <StepShell title="" showBack={false}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        {status === "processing" ? (
          <>
            <div
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900"
            />
            <p className="text-sm text-stone-600">{t("processing")}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-red-500">{message}</p>
            {slotIsGone ? (
              <PrimaryButton className="w-auto px-8" onClick={() => goToStep("time")}>
                {t("chooseAnotherTime")}
              </PrimaryButton>
            ) : (
              <PrimaryButton className="w-auto px-8" onClick={retry}>
                {t("retry")}
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </StepShell>
  );
}
