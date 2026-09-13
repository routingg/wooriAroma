"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { SecondaryButton } from "@/components/common/SecondaryButton";
import { Calendar } from "../Calendar";

export function DateStep() {
  const t = useTranslations("steps.date");
  const tCommon = useTranslations("common");
  const { draft, setDate, goNext, goBack } = useBooking();

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <div className="flex items-center gap-3">
          <SecondaryButton onClick={goBack}>{tCommon("back")}</SecondaryButton>
          <div className="flex-1">
            <PrimaryButton disabled={!draft.date} onClick={goNext}>
              {tCommon("next")}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <Calendar selectedDateKey={draft.date} onSelect={setDate} />
    </StepShell>
  );
}
