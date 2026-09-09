"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BOOKING_STEPS,
  emptyBookingDraft,
  type BookingDetailsDraft,
  type BookingDraft,
  type BookingStep,
} from "@/types/bookingState";
import { loadBookingDraft, saveBookingDraft } from "@/lib/booking/draftStorage";

/**
 * The wizard isn't a flat sequence once "sameCourse"/"guestTreatments" enter
 * the picture: "guests" skips straight to "treatment" for a single guest
 * (there's nothing to ask), and "duration"/"guestTreatments" branch on
 * whether the group chose the same course. Every other transition is just
 * the next/previous entry in BOOKING_STEPS.
 */
function linearStepAt(step: BookingStep, offset: 1 | -1): BookingStep {
  const index = BOOKING_STEPS.indexOf(step);
  const next = Math.min(Math.max(index + offset, 0), BOOKING_STEPS.length - 1);
  return BOOKING_STEPS[next];
}

function nextStepFor(draft: BookingDraft): BookingStep {
  switch (draft.step) {
    case "guests":
      return (draft.guestCount ?? 0) >= 2 ? "sameCourse" : "treatment";
    case "sameCourse":
      return "treatment";
    case "duration":
      return draft.sameCourse === false ? "guestTreatments" : "date";
    case "guestTreatments":
      return "date";
    default:
      return linearStepAt(draft.step, 1);
  }
}

function previousStepFor(draft: BookingDraft): BookingStep {
  switch (draft.step) {
    case "sameCourse":
      return "guests";
    case "treatment":
      return (draft.guestCount ?? 0) >= 2 ? "sameCourse" : "guests";
    case "guestTreatments":
      return "duration";
    case "date":
      return draft.sameCourse === false ? "guestTreatments" : "duration";
    default:
      return linearStepAt(draft.step, -1);
  }
}

function browserStorage(kind: "localStorage" | "sessionStorage"): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window[kind];
  } catch {
    return undefined;
  }
}

interface BookingContextValue {
  draft: BookingDraft;
  isHydrated: boolean;
  setGuestCount: (guestCount: number) => void;
  setSameCourse: (sameCourse: boolean) => void;
  setTreatment: (serviceId: string) => void;
  setDuration: (serviceOptionId: string) => void;
  setOtherGuestOption: (index: number, serviceOptionId: string) => void;
  resetOtherGuestOptions: () => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setDetails: (details: BookingDetailsDraft) => void;
  setReservationResult: (reservationNumber: string) => void;
  goToStep: (step: BookingStep) => void;
  goNext: () => void;
  goBack: () => void;
  resetBooking: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

function loadDraft(): BookingDraft {
  return loadBookingDraft(browserStorage("localStorage"), browserStorage("sessionStorage"));
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate choices and the short-lived tab session after mount only, so server and first
  // client render match (avoids hydration mismatches). This one-time
  // sync from an external store is the documented exception to
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraft());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveBookingDraft(draft, browserStorage("localStorage"), browserStorage("sessionStorage"));
  }, [draft, isHydrated]);

  const goToStep = useCallback((step: BookingStep) => {
    setDraft((prev) => ({ ...prev, step }));
  }, []);

  const goNext = useCallback(() => {
    setDraft((prev) => ({ ...prev, step: nextStepFor(prev) }));
  }, []);

  const goBack = useCallback(() => {
    setDraft((prev) => ({ ...prev, step: previousStepFor(prev) }));
  }, []);

  const setGuestCount = useCallback((guestCount: number) => {
    setDraft((prev) => ({
      ...prev,
      guestCount,
      // A guest count of 1 skips the "same course?" question entirely, and
      // any different-guest-count change invalidates the per-guest picks.
      sameCourse: guestCount >= 2 ? prev.sameCourse : null,
      otherGuestServiceOptionIds: [],
    }));
  }, []);

  const setSameCourse = useCallback((sameCourse: boolean) => {
    setDraft((prev) => ({
      ...prev,
      sameCourse,
      otherGuestServiceOptionIds: sameCourse ? [] : Array((prev.guestCount ?? 1) - 1).fill(null),
    }));
  }, []);

  const setTreatment = useCallback((serviceId: string) => {
    setDraft((prev) => ({
      ...prev,
      serviceId,
      // Changing the treatment invalidates any previously chosen duration,
      // and any other guests' picks (their duration constraint depended on it).
      serviceOptionId: prev.serviceId === serviceId ? prev.serviceOptionId : null,
      otherGuestServiceOptionIds:
        prev.serviceId === serviceId
          ? prev.otherGuestServiceOptionIds
          : Array(prev.otherGuestServiceOptionIds.length).fill(null),
    }));
  }, []);

  const setDuration = useCallback((serviceOptionId: string) => {
    setDraft((prev) => ({
      ...prev,
      serviceOptionId,
      // A new shared duration invalidates any other guests' picks — they may
      // no longer offer this duration.
      otherGuestServiceOptionIds: Array(prev.otherGuestServiceOptionIds.length).fill(null),
    }));
  }, []);

  const setOtherGuestOption = useCallback((index: number, serviceOptionId: string) => {
    setDraft((prev) => {
      const otherGuestServiceOptionIds = [...prev.otherGuestServiceOptionIds];
      otherGuestServiceOptionIds[index] = serviceOptionId;
      return { ...prev, otherGuestServiceOptionIds };
    });
  }, []);

  const resetOtherGuestOptions = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      otherGuestServiceOptionIds: Array(Math.max((prev.guestCount ?? 1) - 1, 0)).fill(null),
    }));
  }, []);

  const setDate = useCallback((date: string) => {
    setDraft((prev) => ({
      ...prev,
      date,
      time: prev.date === date ? prev.time : null,
    }));
  }, []);

  const setTime = useCallback((time: string) => {
    setDraft((prev) => ({ ...prev, time }));
  }, []);

  const setDetails = useCallback((details: BookingDetailsDraft) => {
    setDraft((prev) => ({ ...prev, details }));
  }, []);

  const setReservationResult = useCallback((reservationNumber: string) => {
    setDraft((prev) => ({ ...prev, reservationNumber }));
  }, []);

  const resetBooking = useCallback(() => {
    setDraft(emptyBookingDraft);
  }, []);

  const value = useMemo<BookingContextValue>(
    () => ({
      draft,
      isHydrated,
      setGuestCount,
      setSameCourse,
      setTreatment,
      setDuration,
      setOtherGuestOption,
      resetOtherGuestOptions,
      setDate,
      setTime,
      setDetails,
      setReservationResult,
      goToStep,
      goNext,
      goBack,
      resetBooking,
    }),
    [
      draft,
      isHydrated,
      setGuestCount,
      setSameCourse,
      setTreatment,
      setDuration,
      setOtherGuestOption,
      resetOtherGuestOptions,
      setDate,
      setTime,
      setDetails,
      setReservationResult,
      goToStep,
      goNext,
      goBack,
      resetBooking,
    ],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
