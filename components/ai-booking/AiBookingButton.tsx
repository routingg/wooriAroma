"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AiBookingDialog } from "./AiBookingDialog";

const TONE_CLASS: Record<"light" | "dark", string> = {
  // Hero variants on a light background (minimal, editorial, dark-luxury's translucent overlay).
  light: "text-stone-700 hover:text-stone-900",
  // Hero variants on a dark image overlay (forest, resort).
  dark: "text-stone-100/90 hover:text-stone-50",
};

/**
 * Secondary CTA — deliberately understated (plain underlined text, no
 * fill, no icon) so it never competes visually with the primary "Book
 * Your Experience" button next to it (task spec §2: "AI가 기존 예약
 * 위저드보다 시각적으로 더 강한 CTA가 되면 안 된다"). Opens
 * AiBookingDialog; the existing Booking Wizard is untouched.
 */
export function AiBookingButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useTranslations("aiAssistant");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-3 inline-flex min-h-10 items-center justify-center text-sm font-medium underline decoration-1 underline-offset-4 transition-colors ${TONE_CLASS[tone]}`}
      >
        {t("ctaLabel")}
      </button>
      {open ? <AiBookingDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
