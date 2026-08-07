"use client";

import { useLocale, useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { Link } from "@/i18n/navigation";
import { getService, getServiceOption } from "@/data/services";
import { calculateDepositAmount, calculateRemainingAmount, calculateTotalAmount, formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import type { AppLocale } from "@/i18n/routing";

const INSTAGRAM_URL = "https://www.instagram.com/aromatogether/";

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

  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${draft.date}T00:00:00`));

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
          <Row
            label={t("treatment")}
            value={`${tServices(service.nameKey.replace("services.", ""))} · ${option.durationMinutes} ${tCommon("min")}`}
          />
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
          <PlaceholderAction label={t("viewLocation")} />
          <PlaceholderAction label={t("addToCalendar")} />
          <PlaceholderAction label={t("contactUs")} />
          <ExternalLinkAction label={t("instagram")} href={INSTAGRAM_URL} />
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

// View Location / Add to Calendar / Contact Woori Aroma are wired up
// once Google Maps, calendar export and a verified WhatsApp/phone
// business contact exist (see lib/notifications for the confirmation
// email/SMS side of this).
function PlaceholderAction({ label }: { label: string }) {
  return (
    <button type="button" disabled className={`${actionClass} border-stone-200 bg-white text-stone-500`}>
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
