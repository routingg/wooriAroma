"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getPaymentProvider } from "@/lib/payment";
import { calculateDepositAmount } from "@/lib/booking/pricing";
import { generateReservationNumber } from "@/lib/booking/mockData";

export function PaymentStep() {
  const t = useTranslations("steps.payment");
  const { draft, setPaymentResult, goNext } = useBooking();
  const [status, setStatus] = useState<"processing" | "failed">("processing");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current || !draft.details || !draft.guestCount) return;
    hasStarted.current = true;

    const reservationNumber = draft.reservationNumber ?? generateReservationNumber(draft.date ?? "");
    const deposit = calculateDepositAmount(draft.guestCount);

    getPaymentProvider()
      .chargeDeposit({
        amount: deposit,
        currency: "KRW",
        reservationNumber,
        customerName: draft.details.name,
        customerEmail: draft.details.email,
      })
      .then((result) => {
        if (result.success) {
          setPaymentResult(reservationNumber, result.transactionId);
          goNext();
        } else {
          setStatus("failed");
        }
      });
  }, [draft, goNext, setPaymentResult]);

  function retry() {
    hasStarted.current = false;
    setStatus("processing");
  }

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
            <p className="text-sm text-red-500">{t("failed")}</p>
            <PrimaryButton className="w-auto px-8" onClick={retry}>
              {t("retry")}
            </PrimaryButton>
          </>
        )}
      </div>
    </StepShell>
  );
}
