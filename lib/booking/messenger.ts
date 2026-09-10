/**
 * Optional messenger contact collected alongside the phone number. Guests
 * travelling from abroad are usually unreachable on the number they typed,
 * so staff need a second channel that works over data.
 */
export const MESSENGER_APPS = ["WHATSAPP", "TELEGRAM", "WECHAT"] as const;

export type MessengerApp = (typeof MESSENGER_APPS)[number];

export interface MessengerContact {
  app: MessengerApp;
  /** Phone number, @username or app-specific id — format varies per app. */
  handle: string;
}

/** Brand names, deliberately untranslated across all locales. */
export const MESSENGER_APP_LABELS: Record<MessengerApp, string> = {
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  WECHAT: "WeChat",
};

/**
 * Each app identifies people differently, so the hint has to come from the
 * selected app rather than from a translated string.
 */
export const MESSENGER_HANDLE_PLACEHOLDERS: Record<MessengerApp, string> = {
  WHATSAPP: "+82 10 1234 5678",
  TELEGRAM: "@username",
  WECHAT: "wechat_id",
};

/**
 * Deliberately loose — it has to accept a phone number, an @username and a
 * WeChat id at once. It only rejects input that could not identify anyone.
 */
export const MESSENGER_HANDLE_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9@+._\-\s]{3,64}$/;

export function isMessengerApp(value: unknown): value is MessengerApp {
  return typeof value === "string" && (MESSENGER_APPS as readonly string[]).includes(value);
}

export function formatMessengerContact(contact: MessengerContact): string {
  return `${MESSENGER_APP_LABELS[contact.app]} · ${contact.handle}`;
}

/**
 * A URL that opens the conversation, or null when the handle can't produce
 * one. WeChat has no public web scheme for reaching an id, and Telegram's
 * t.me only resolves usernames — never fabricate a link for those cases,
 * the handle is still shown as text.
 */
export function messengerLink(contact: MessengerContact): string | null {
  const handle = contact.handle.trim();
  switch (contact.app) {
    case "WHATSAPP": {
      const digits = handle.replace(/\D/g, "");
      return digits.length >= 8 ? `https://wa.me/${digits}` : null;
    }
    case "TELEGRAM": {
      const username = handle.replace(/^@/, "");
      return /^[A-Za-z]\w{4,31}$/.test(username) ? `https://t.me/${username}` : null;
    }
    case "WECHAT":
      return null;
  }
}
