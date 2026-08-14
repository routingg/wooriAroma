import { BUSINESS, googleMapsPinUrl } from "@/lib/config/business";

interface SiteFooterProps {
  heading: string;
  tagline: string;
  mapsCta: string;
  instagramLabel: string;
}

/**
 * Store info footer for the "/" landing page only (not the shared
 * [locale] layout, so it never renders on /book or other routes).
 * Intentionally has no reservation/Calendly CTA — that flow lives
 * elsewhere on the site; this section is location/contact only.
 */
export function SiteFooter({ heading, tagline, mapsCta, instagramLabel }: SiteFooterProps) {
  return (
    <footer className="bg-stone-900 px-6 py-14 text-stone-300 sm:py-16">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <div>
          <p className="text-xs font-medium tracking-[0.3em] text-stone-400 uppercase">{heading}</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">{tagline}</p>
        </div>

        <div className="text-sm leading-relaxed text-stone-300">
          {BUSINESS.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <a
          href={googleMapsPinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[var(--radius-button)] bg-stone-50 px-6 text-center text-sm font-medium text-stone-900 shadow-lg transition-colors hover:bg-stone-100 sm:w-auto"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
            <path
              d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span>{mapsCta}</span>
        </a>

        <div className="flex flex-col items-center gap-2 text-sm text-stone-300 sm:flex-row sm:gap-4">
          <a href={BUSINESS.phoneHref} className="min-h-11 py-2 transition-colors hover:text-stone-50">
            {BUSINESS.phone}
          </a>
          <span aria-hidden="true" className="hidden text-stone-600 sm:inline">
            ·
          </span>
          <a
            href={BUSINESS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 py-2 transition-colors hover:text-stone-50"
          >
            {instagramLabel} {BUSINESS.instagramHandle}
          </a>
        </div>
      </div>
    </footer>
  );
}
