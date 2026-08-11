"use client";

import { useLocale, useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { Link } from "@/i18n/navigation";
import { getService, getServiceOption } from "@/data/services";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount, formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel, fromMinutes, toMinutes } from "@/lib/booking/time";
import { buildReservationIcs } from "@/lib/booking/ics";
import { BUSINESS, googleMapsUrl } from "@/lib/config/business";
import type { AppLocale } from "@/i18n/routing";

export function ConfirmationStep() {
  const t = useTranslations("steps.confirmation");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("services");
  const locale = useLocale() as AppLocale;
  const { draft, resetBooking } = useBooking();

  const option = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId) : undefined;
  const service = option ? getService(option.serviceId) : undefined;
  const guestCount = draft.guestCount ?? 0;

  if (!option || !service || !draft.date || !draft.time || !draft.reservationNumber || !draft.details) {
    return null;
  }

  const total = calculateTotalAmount(option.pricePerPerson, guestCount);
  const deposit = calculateDepositAmount(guestCount);
  const remaining = calculateRemainingAmount(total, deposit);
  const treatmentName = tServices(service.nameKey.replace("services.", ""));

  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${draft.date}T00:00:00`));

  function downloadIcs() {
    const ics = buildReservationIcs({
      reservationNumber: draft.reservationNumber!,
      treatmentName,
      dateKey: draft.date!,
      startTime: draft.time!,
      endTime: fromMinutes(toMinutes(draft.time!) + option!.durationMinutes),
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.reservationNumber}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-stone-50">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7">
            <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-stone-600">{t("subtitle")}</p>
      </div>

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <span className="text-sm text-stone-500">{t("reservationNumber")}</span>
          <span className="font-mono text-sm font-medium text-stone-900">{draft.reservationNumber}</span>
        </div>

        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <Row label={t("customerName")} value={draft.details.name} />
          <Row label={t("date")} value={dateLabel} />
          <Row label={t("time")} value={formatTimeLabel(draft.time, locale)} />
          <Row label={t("guests")} value={String(guestCount)} />
          <Row label={t("treatment")} value={`${treatmentName} · ${option.durationMinutes} ${tCommon("min")}`} />
        </dl>

        <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 text-sm">
          <div className="flex items-center justify-between text-stone-600">
            <span>{t("totalAmount")}</span>
            <span>{formatCurrency(total, locale)}</span>
          </div>
          <div className="flex items-center justify-between font-medium text-stone-900">
            <span>{t("depositPaid")}</span>
            <span>{formatCurrency(deposit, locale)}</span>
          </div>
          <div className="flex items-center justify-between text-stone-600">
            <span>{t("remainingBalance")}</span>
            <span>{formatCurrency(remaining, locale)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-medium text-stone-900">{t("needHelpTitle")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ExternalLinkAction label={t("viewLocation")} href={googleMapsUrl()} />
          <ActionButton label={t("addToCalendar")} onClick={downloadIcs} />
          {/* No verified phone/WhatsApp exists yet (AGENTS.md: never invent
              contact info) — Instagram DM is the only real channel today. */}
          <ExternalLinkAction label={t("contactUs")} href={BUSINESS.instagramUrl} />
          <ExternalLinkAction label={t("instagram")} href={BUSINESS.instagramUrl} />
        </div>
      </div>

      <Link
        href="/"
        onClick={resetBooking}
        className="mt-10 flex min-h-14 w-full items-center justify-center rounded-full border border-stone-300 px-6 text-base font-medium text-stone-800 transition-colors hover:bg-stone-100"
      >
        {t("bookAnother")}
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}

const actionClass =
  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-center text-xs transition-colors";

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${actionClass} border-stone-200 bg-white text-stone-800 hover:border-stone-400`}
    >
      {label}
    </button>
  );
}

function ExternalLinkAction({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${actionClass} border-stone-200 bg-white text-stone-800 hover:border-stone-400`}
    >
      {label}
    </a>
  );
}
