"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getPaymentProvider } from "@/lib/payment";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount } from "@/lib/booking/pricing";
import { generateReservationNumber } from "@/lib/booking/mockData";
import { getService, getServiceOption } from "@/data/services";
import { notifyBookingCreated } from "@/lib/notifications";

export function PaymentStep() {
  const t = useTranslations("steps.payment");
  const tServices = useTranslations("services");
  const { draft, setPaymentResult, goNext } = useBooking();
  const [status, setStatus] = useState<"processing" | "failed">("processing");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current || !draft.details || !draft.guestCount) return;
    hasStarted.current = true;

    const guestCount = draft.guestCount;
    const reservationNumber = draft.reservationNumber ?? generateReservationNumber(draft.date ?? "");
    const deposit = calculateDepositAmount(guestCount);

    getPaymentProvider()
      .chargeDeposit({
        amount: deposit,
        currency: "KRW",
        reservationNumber,
        customerName: draft.details.name,
        customerEmail: draft.details.email,
      })
      .then((result) => {
        if (!result.success) {
          setStatus("failed");
          return;
        }

        setPaymentResult(reservationNumber, result.transactionId);

        const option = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId) : undefined;
        const service = option ? getService(option.serviceId) : undefined;
        if (option && service && draft.date && draft.time && draft.details) {
          const total = calculateTotalAmount(option.pricePerPerson, guestCount);
          // Fire-and-forget: notification delivery must never gate the
          // confirmation screen or affect this already-successful reservation.
          void notifyBookingCreated({
            reservationNumber,
            customerName: draft.details.name,
            customerEmail: draft.details.email,
            customerPhone: draft.details.phone,
            preferredLanguage: draft.details.preferredLanguage,
            date: draft.date,
            time: draft.time,
            guestCount,
            treatmentName: tServices(service.nameKey.replace("services.", "")),
            durationMinutes: option.durationMinutes,
            totalAmount: total,
            depositAmount: deposit,
            remainingAmount: calculateRemainingAmount(total, deposit),
          });
        }

        goNext();
      });
  }, [draft, goNext, setPaymentResult, tServices]);

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
