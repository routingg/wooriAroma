"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "../BookingProvider";
import { StepShell } from "../StepShell";
import { PrimaryButton } from "@/components/common/PrimaryButton";
import { getBookableServices, getServiceOption } from "@/data/services";

/**
 * Guest 1's treatment/duration was already chosen on the "treatment" and
 * "duration" steps (reused as-is for the "same course" path too). This step
 * only handles guests 2..guestCount, one at a time: picking a service for
 * the current guest immediately advances to the next unfilled guest, so no
 * extra "confirm this guest" tap is needed — the footer's Next only enables
 * once every other guest has a pick.
 */
export function GuestTreatmentsStep() {
  const t = useTranslations("steps.guestTreatments");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("services");
  const { draft, setOtherGuestOption, goNext } = useBooking();

  const others = draft.otherGuestServiceOptionIds;
  const pendingIndex = others.findIndex((id) => id === null);
  const allChosen = pendingIndex === -1;
  const guestNumber = pendingIndex + 2;

  const groupDuration = draft.serviceOptionId ? getServiceOption(draft.serviceOptionId)?.durationMinutes : undefined;
  const eligibleServices = groupDuration
    ? getBookableServices()
        .map((service) => ({
          service,
          option: service.options.find((o) => o.durationMinutes === groupDuration),
        }))
        .filter((entry): entry is { service: (typeof entry)["service"]; option: NonNullable<(typeof entry)["option"]> } =>
          Boolean(entry.option),
        )
    : [];

  return (
    <StepShell
      title={allChosen ? t("reviewTitle") : t("title", { guestNumber })}
      subtitle={!allChosen && groupDuration ? t("subtitle", { minutes: groupDuration }) : undefined}
      footer={
        <PrimaryButton disabled={!allChosen} onClick={goNext}>
          {tCommon("next")}
        </PrimaryButton>
      }
    >
      {allChosen ? (
        <ul className="flex flex-col gap-2 text-sm text-stone-600">
          {others.map((id, index) => {
            const option = id ? getServiceOption(id) : undefined;
            const service = eligibleServices.find((entry) => entry.option.id === id)?.service;
            return (
              <li key={index} className="rounded-xl border border-stone-200 bg-stone-100 px-4 py-3">
                <span className="font-medium text-stone-900">
                  {tCommon("guestLabel", { n: index + 2 })}
                </span>{" "}
                — {service ? tServices(service.nameKey.replace("services.", "")) : id}
                {option ? ` · ${option.durationMinutes} ${tCommon("min")}` : ""}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          {eligibleServices.map(({ service, option }) => {
            const nameKey = service.nameKey.replace("services.", "");
            const descriptionKey = service.descriptionKey.replace("services.", "");
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => setOtherGuestOption(pendingIndex, option.id)}
                className="flex flex-col rounded-2xl border-2 border-stone-200 bg-stone-100 p-5 text-left text-stone-800 transition-colors hover:border-stone-400"
              >
                <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  {tServices(nameKey)}
                </span>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{tServices(descriptionKey)}</p>
              </button>
            );
          })}
        </div>
      )}
    </StepShell>
  );
}
