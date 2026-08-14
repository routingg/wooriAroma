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

const STORAGE_KEY = "wa_booking_draft";

interface BookingContextValue {
  draft: BookingDraft;
  isHydrated: boolean;
  setGuestCount: (guestCount: number) => void;
  setTreatment: (serviceId: string) => void;
  setDuration: (serviceOptionId: string) => void;
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
  if (typeof window === "undefined") return emptyBookingDraft;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyBookingDraft;
    return { ...emptyBookingDraft, ...JSON.parse(raw) };
  } catch {
    return emptyBookingDraft;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(emptyBookingDraft);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount only, so server and first
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, isHydrated]);

  const goToStep = useCallback((step: BookingStep) => {
    setDraft((prev) => ({ ...prev, step }));
  }, []);

  const goNext = useCallback(() => {
    setDraft((prev) => {
      const index = BOOKING_STEPS.indexOf(prev.step);
      const next = BOOKING_STEPS[Math.min(index + 1, BOOKING_STEPS.length - 1)];
      return { ...prev, step: next };
    });
  }, []);

  const goBack = useCallback(() => {
    setDraft((prev) => {
      const index = BOOKING_STEPS.indexOf(prev.step);
      const previous = BOOKING_STEPS[Math.max(index - 1, 0)];
      return { ...prev, step: previous };
    });
  }, []);

  const setGuestCount = useCallback((guestCount: number) => {
    setDraft((prev) => ({ ...prev, guestCount }));
  }, []);

  const setTreatment = useCallback((serviceId: string) => {
    setDraft((prev) => ({
      ...prev,
      serviceId,
      // Changing the treatment invalidates any previously chosen duration.
      serviceOptionId: prev.serviceId === serviceId ? prev.serviceOptionId : null,
    }));
  }, []);

  const setDuration = useCallback((serviceOptionId: string) => {
    setDraft((prev) => ({ ...prev, serviceOptionId }));
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
      setTreatment,
      setDuration,
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
      setTreatment,
      setDuration,
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
