"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { Calendar } from "../Calendar";

export function DateStep() {
  const t = useTranslations("steps.date");
  const tCommon = useTranslations("common");
  const { draft, setDate, goNext } = useBooking();

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <PrimaryButton disabled={!draft.date} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      <Calendar selectedDateKey={draft.date} onSelect={setDate} />
    </StepShell>
  );
}
