"use client";

import { useEffect } from "react";
import { useBooking } from "./BookingProvider";
import { GuestsStep } from "./steps/GuestsStep";
import { TreatmentStep } from "./steps/TreatmentStep";
import { DurationStep } from "./steps/DurationStep";
import { DateStep } from "./steps/DateStep";
import { TimeStep } from "./steps/TimeStep";
import { DetailsStep } from "./steps/DetailsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SubmitStep } from "./steps/SubmitStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import type { BookingDraft, BookingStep } from "@/types/bookingState";

/** The earliest step whose prerequisite selection is still missing. */
function firstIncompleteStep(draft: BookingDraft): BookingStep | null {
  if (!draft.guestCount) return "guests";
  if (!draft.serviceId) return "treatment";
  if (!draft.serviceOptionId) return "duration";
  if (!draft.date) return "date";
  if (!draft.time) return "time";
  if (draft.step === "review" || draft.step === "submit" || draft.step === "confirmation") {
    if (!draft.details) return "details";
  }
  if (draft.step === "confirmation" && !draft.reservationNumber) return "review";
  return null;
}

export function BookingWizard() {
  const { draft, isHydrated, goToStep } = useBooking();

  // Only validate once, right when a (possibly stale or tampered)
  // persisted draft is loaded — e.g. a refresh mid-flow. Re-running
  // this on every step change would fight intentional Back navigation:
  // going Back from "duration" to "treatment" leaves serviceOptionId
  // unset, which is expected, not a state to auto-correct away from.
  useEffect(() => {
    if (!isHydrated) return;
    const requiredStep = firstIncompleteStep(draft);
    if (requiredStep && requiredStep !== draft.step) {
      goToStep(requiredStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  if (!isHydrated) {
    return <div className="flex-1" />;
  }

  switch (draft.step) {
    case "guests":
      return <GuestsStep />;
    case "treatment":
      return <TreatmentStep />;
    case "duration":
      return <DurationStep />;
    case "date":
      return <DateStep />;
    case "time":
      return <TimeStep />;
    case "details":
      return <DetailsStep />;
    case "review":
      return <ReviewStep />;
    case "submit":
      return <SubmitStep />;
    case "confirmation":
      return <ConfirmationStep />;
    default:
      return null;
  }
}
