"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { routing, type AppLocale } from "@/i18n/routing";
import { localeNames } from "@/i18n/config";
import type { BookingDetailsDraft } from "@/types/bookingState";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;

export function DetailsStep() {
  const t = useTranslations("steps.details");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const locale = useLocale() as AppLocale;
  const { draft, setDetails, goNext } = useBooking();

  const [form, setForm] = useState<BookingDetailsDraft>(
    draft.details ?? {
      name: "",
      phone: "",
      email: "",
      preferredLanguage: locale,
      specialRequest: "",
    },
  );
  const [touched, setTouched] = useState(false);

  const errors = {
    name: form.name.trim().length === 0,
    phone: !PHONE_PATTERN.test(form.phone.trim()),
    email: !EMAIL_PATTERN.test(form.email.trim()),
  };
  const isValid = !errors.name && !errors.phone && !errors.email;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!isValid) return;
    setDetails(form);
    goNext();
  }

  function field<K extends keyof BookingDetailsDraft>(key: K, value: BookingDetailsDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputClass =
    "w-full min-h-12 rounded-xl border border-stone-300 bg-stone-100 px-4 text-base text-stone-900 outline-none transition-colors focus:border-stone-900";
  const errorClass = "border-red-400 focus:border-red-500";

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <PrimaryButton form="details-form" type="submit">
          {tCommon("continue")}
        </PrimaryButton>
      }
    >
      <form id="details-form" onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-800">
            {t("name")} <span className="text-stone-400">({tCommon("required")})</span>
          </span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => field("name", e.target.value)}
            placeholder={t("namePlaceholder")}
            className={`${inputClass} ${touched && errors.name ? errorClass : ""}`}
          />
          {touched && errors.name && <span className="text-xs text-red-500">{tValidation("required")}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-800">
            {t("phone")} <span className="text-stone-400">({tCommon("required")})</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => field("phone", e.target.value)}
            placeholder="+82 10 1234 5678"
            className={`${inputClass} ${touched && errors.phone ? errorClass : ""}`}
          />
          {touched && errors.phone && <span className="text-xs text-red-500">{tValidation("invalidPhone")}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-800">
            {t("email")} <span className="text-stone-400">({tCommon("required")})</span>
          </span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => field("email", e.target.value)}
            placeholder={t("emailPlaceholder")}
            className={`${inputClass} ${touched && errors.email ? errorClass : ""}`}
          />
          {touched && errors.email && <span className="text-xs text-red-500">{tValidation("invalidEmail")}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-800">{t("preferredLanguage")}</span>
          <select
            value={form.preferredLanguage}
            onChange={(e) => field("preferredLanguage", e.target.value as AppLocale)}
            className={inputClass}
          >
            {routing.locales.map((code) => (
              <option key={code} value={code}>
                {localeNames[code]}
              </option>
            ))}
          </select>
          <span className="text-xs text-stone-500">{t("preferredLanguageHint")}</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-800">
            {t("specialRequest")} <span className="text-stone-400">({tCommon("optional")})</span>
          </span>
          <textarea
            value={form.specialRequest}
            onChange={(e) => field("specialRequest", e.target.value)}
            placeholder={t("specialRequestPlaceholder")}
            rows={3}
            className={`${inputClass} min-h-24 resize-none py-3`}
          />
        </label>
      </form>
    </StepShell>
  );
}
