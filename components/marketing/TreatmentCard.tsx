import Image from "next/image";
import type { StaticImageData } from "next/image";

export interface TreatmentCardOption {
  durationMinutes: number;
  price: number;
  /** Bullet points describing what this duration includes. */
  contents: string[];
  mostPopular: boolean;
}

export interface TreatmentCardProps {
  image: StaticImageData;
  imageAlt: string;
  name: string;
  description: string;
  /** Short customer-facing phrase or characteristic tags, e.g. "Best for gentle relaxation." */
  tagline?: string;
  options: TreatmentCardOption[];
  /** Shown below all options when a treatment has multiple durations, e.g. "Every Course Includes". */
  everyCourseLabel?: string;
  everyCourseIncludes?: string[];
  /** Shown instead of inline per-option contents when a treatment has a single duration. */
  includesLabel: string;
  bestForLabel: string;
  bestFor: string[];
  mostPopularLabel: string;
  minLabel: string;
}

const krwFormatter = new Intl.NumberFormat("en-US");

function formatKrw(price: number) {
  return `KRW ${krwFormatter.format(price)}`;
}

export function TreatmentCard({
  image,
  imageAlt,
  name,
  description,
  tagline,
  options,
  everyCourseLabel,
  everyCourseIncludes,
  includesLabel,
  bestForLabel,
  bestFor,
  mostPopularLabel,
  minLabel,
}: TreatmentCardProps) {
  const hasMultipleOptions = options.length > 1;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-200">
        <Image
          src={image}
          alt={imageAlt}
          fill
          placeholder="blur"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900 sm:text-xl">
            {name}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{description}</p>
          {tagline ? <p className="mt-1.5 text-sm leading-relaxed text-stone-500 italic">{tagline}</p> : null}
        </div>

        <div className="flex flex-col divide-y divide-stone-200 border-y border-stone-200">
          {options.map((option) => (
            <div key={option.durationMinutes} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">
                  {option.durationMinutes} {minLabel}
                </p>
                {hasMultipleOptions ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{option.contents.join(" · ")}</p>
                ) : null}
                {option.mostPopular ? (
                  <span className="mt-1.5 inline-block rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-medium text-forest-700">
                    ★ {mostPopularLabel}
                  </span>
                ) : null}
              </div>
              <p className="shrink-0 whitespace-nowrap text-sm font-semibold text-stone-900">
                {formatKrw(option.price)}
              </p>
            </div>
          ))}
        </div>

        {!hasMultipleOptions ? (
          <div className="text-xs leading-relaxed text-stone-600">
            <p className="font-medium text-stone-700">{includesLabel}</p>
            <p className="mt-0.5">{options[0]?.contents.join(" · ")}</p>
          </div>
        ) : everyCourseIncludes && everyCourseIncludes.length > 0 ? (
          <div className="text-xs leading-relaxed text-stone-600">
            <p className="font-medium text-stone-700">{everyCourseLabel}</p>
            <p className="mt-0.5">{everyCourseIncludes.join(" · ")}</p>
          </div>
        ) : null}

        <div className="mt-auto text-xs leading-relaxed text-stone-600">
          <p className="font-medium text-stone-700">{bestForLabel}</p>
          <p className="mt-0.5">{bestFor.join(" · ")}</p>
        </div>
      </div>
    </div>
  );
}
