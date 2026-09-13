"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { SecondaryButton } from "@/components/common/SecondaryButton";
import { services } from "@/data/services";

export function TreatmentStep() {
  const t = useTranslations("steps.treatment");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("services");
  const { draft, setTreatment, goNext, goBack } = useBooking();

  const sortedServices = [...services].sort((a, b) => a.order - b.order);

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <div className="flex items-center gap-3">
          <SecondaryButton onClick={goBack}>{tCommon("back")}</SecondaryButton>
          <div className="flex-1">
            <PrimaryButton disabled={!draft.serviceId} onClick={goNext}>
              {tCommon("next")}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {sortedServices.map((service) => {
          const selected = draft.serviceId === service.id;
          const disabled = service.options.length === 0;
          const nameKey = service.nameKey.replace("services.", "");
          const descriptionKey = service.descriptionKey.replace("services.", "");

          return (
            <button
              key={service.id}
              type="button"
              disabled={disabled}
              onClick={() => setTreatment(service.id)}
              aria-pressed={selected}
              className={`flex flex-col rounded-2xl border-2 p-5 text-left transition-colors ${
                disabled
                  ? "cursor-not-allowed border-stone-100 bg-stone-50 text-stone-400"
                  : selected
                    ? "border-stone-900 bg-stone-900 text-stone-50"
                    : "border-stone-200 bg-stone-100 text-stone-800 hover:border-stone-400"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  {tServices(nameKey)}
                </span>
                {disabled ? (
                  <span className="rounded-full bg-stone-200 px-2.5 py-1 text-xs text-stone-500">
                    {t("comingSoon")}
                  </span>
                ) : null}
              </div>
              <p className={`mt-1.5 text-sm leading-relaxed ${selected ? "text-stone-200" : "text-stone-600"}`}>
                {tServices(descriptionKey)}
              </p>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
