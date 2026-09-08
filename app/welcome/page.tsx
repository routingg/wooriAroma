import type { Metadata } from "next";
import { WelcomeGuide } from "./WelcomeGuide";

/**
 * In-store guest kiosk, opened by staff on a tablet the moment a guest
 * arrives (not a customer-discoverable marketing page) — kept out of
 * search results accordingly.
 */
export const metadata: Metadata = {
  title: "Welcome — Woori Aroma",
  robots: { index: false, follow: false },
};

export default function WelcomeKioskPage() {
  return <WelcomeGuide />;
}
