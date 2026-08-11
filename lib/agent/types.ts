import type { AppLocale } from "@/i18n/routing";

/**
 * Internal intent structure an NLU layer would populate from a customer's
 * freeform message (AGENTS.md §16.3), e.g. "Can two of us get a 90-minute
 * aroma massage tomorrow around 3pm?". This project does not wire up an
 * actual Gemini/LLM call — that's a separate deployment step outside this
 * codebase — but this is the shape such an integration would produce
 * before calling the tools in lib/agent/tools.ts.
 */
export interface BookingIntent {
  partySize?: number;
  serviceId?: string;
  duration?: number;
  preferredDate?: string;
  preferredTime?: string;
  customerName?: string;
  phoneOrWhatsapp?: string;
  email?: string;
  locale?: AppLocale;
  notes?: string;
}
