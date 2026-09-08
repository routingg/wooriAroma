"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import Image from "next/image";
import { getServiceOption } from "@/data/services";
import { treatmentShowcase } from "@/data/treatmentShowcase";
import { serviceImages } from "@/data/media";
import { BUSINESS } from "@/lib/config/business";
import messages from "@/messages/en.json";
import heroImage from "@/docs/images/woori-aroma-reception-lounge.jpg";
import aboutImage from "@/docs/images/woori-aroma-footbath-lounge.jpg";
import ambienceInterior from "@/docs/images/woori-aroma-treatment-room-warm-light.jpg";
import ambienceProducts from "@/docs/images/woori-aroma-products-display.jpg";
import ambienceExterior from "@/docs/images/woori-aroma-exterior-deck-garden.jpg";
import closingImage from "@/docs/images/woori-aroma-exterior-backlit.jpg";

/**
 * Staff-run guest kiosk (see app/welcome/page.tsx) — a tablet slideshow
 * staff hand to a guest the moment they arrive, walking through the same
 * welcome/consultation/treatment-menu/closing flow as the "Woori Aroma
 * welcome deck.pdf" reference deck, rebuilt as a live page so pricing and
 * treatment names can never drift from data/services.ts (the booking
 * flow's own source of truth) the way a static PDF inevitably would.
 *
 * Treatment copy (description/tagline/bestFor/includes) is read from the
 * "treatmentShowcase" i18n namespace, already used by the "/" landing
 * page's treatment cards — this reuses that copy rather than forking a
 * second copy of it. That namespace isn't yet translated into Korean
 * (messages/ko.json mirrors English there), so — matching the reference
 * deck itself, whose treatment-detail slides are English-only — the menu
 * and treatment slides below stay English-only; only the atmosphere/
 * instructional slides carry the bilingual EN/KO pairing the deck uses.
 */

type ShowcaseCopy = {
  description: string;
  tagline?: string;
  everyCourseIncludes?: string[];
  bestFor: string[];
  options: Record<string, string[]>;
};

const serviceCopy = messages.services as unknown as Record<string, { name: string; description: string }>;
const showcaseCopy = messages.treatmentShowcase as unknown as Record<string, ShowcaseCopy>;

function formatKrw(amount: number): string {
  return `KRW ${amount.toLocaleString("en-US")}`;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-[0.3em] text-forest-600 uppercase">{children}</p>;
}

function Heading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-[family-name:var(--font-display)] text-4xl font-semibold sm:text-5xl ${className}`}
    >
      {children}
    </h2>
  );
}

function HeroSlide() {
  return (
    <div className="relative h-full w-full">
      <Image src={heroImage} alt="Woori Aroma treatment lounge" fill priority className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
      <div className="absolute inset-0 flex flex-col justify-end px-8 pb-20 sm:px-16 sm:pb-24">
        <p className="text-xs font-medium tracking-[0.4em] text-stone-200 uppercase">Woori Aroma · Jeju</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold text-white sm:text-7xl">
          Welcome to
          <br />
          Woori Aroma
        </h1>
        <p className="mt-5 max-w-md text-lg text-stone-100">Your quiet moment in Jeju begins here.</p>
        <p className="text-base text-stone-300">우리같이 아로마에 오신 것을 환영합니다.</p>
      </div>
    </div>
  );
}

function SlowDownSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-stone-900 px-8 text-center">
      <span aria-hidden="true" className="h-14 w-px bg-stone-600" />
      <h2 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-semibold text-stone-50 sm:text-6xl">
        You&rsquo;ve arrived.
        <br />
        Now, slow down.
      </h2>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-300 sm:text-lg">
        You may have spent the day driving, walking, and exploring Jeju.
        <br />
        From this moment, there is no need to hurry.
      </p>
      <p className="mt-2 text-sm text-stone-400">여행의 속도를 잠시 내려놓으세요.</p>
      <span aria-hidden="true" className="mt-8 h-14 w-px bg-stone-600" />
    </div>
  );
}

function AboutSlide() {
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center bg-stone-100 px-8 py-12 sm:px-16">
        <Eyebrow>About Woori Aroma</Eyebrow>
        <Heading className="mt-3 text-stone-900">
          A quiet, private
          <br />
          wellness space in Jeju.
        </Heading>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-stone-600">
          Woori Aroma is designed for guests who want to step away from the busy rhythm of travel and enjoy a
          peaceful treatment experience.
        </p>
        <p className="mt-8 text-xs font-medium tracking-[0.3em] text-stone-500 uppercase">Private · Quiet · Personal</p>
      </div>
      <div className="relative hidden md:block">
        <Image src={aboutImage} alt="Woori Aroma foot-bath lounge" fill className="object-cover" sizes="50vw" />
      </div>
    </div>
  );
}

const SPACE_FEATURES = [
  { en: "One Reservation", ko: "한 팀의 예약" },
  { en: "Private Space", ko: "온전한 프라이빗 공간" },
  { en: "Your Time to Relax", ko: "오롯이 쉬는 시간" },
];

function SpaceTimeSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50 px-8 text-center">
      <Heading className="text-stone-900">Your space. Your time.</Heading>
      <p className="mt-3 max-w-md text-base text-stone-600">
        Everything here is prepared for you to feel private and comfortable.
      </p>
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
        {SPACE_FEATURES.map((f) => (
          <div key={f.en}>
            <p className="text-sm font-semibold tracking-[0.15em] text-stone-800 uppercase">{f.en}</p>
            <p className="mt-1 text-sm text-stone-400">{f.ko}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const NEXT_STEPS = [
  { n: "01", en: "Welcome", ko: "환영 인사" },
  { n: "02", en: "Foot Bath", ko: "따뜻한 족욕" },
  { n: "03", en: "Consultation", ko: "간단한 상담" },
  { n: "04", en: "Treatment", ko: "트리트먼트" },
  { n: "05", en: "Rest", ko: "휴식" },
];

function NextStepsSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-stone-50 px-8 py-10 sm:px-16">
      <Eyebrow>Your Experience Today</Eyebrow>
      <Heading className="mt-3 text-stone-900">What happens next?</Heading>
      <div className="mt-10 grid grid-cols-2 gap-6 border-t border-stone-200 pt-8 sm:grid-cols-5">
        {NEXT_STEPS.map((s) => (
          <div key={s.n} className="border-l border-stone-200 pl-4 first:border-l-0 first:pl-0 sm:pl-6">
            <p className="font-[family-name:var(--font-display)] text-2xl text-stone-300 italic">{s.n}</p>
            <p className="mt-1 text-sm font-semibold tracking-wide text-stone-800 uppercase">{s.en}</p>
            <p className="text-xs text-stone-400">{s.ko}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-lg text-sm text-stone-500">
        Your therapist will guide you through each step. There is nothing you need to prepare.
      </p>
    </div>
  );
}

type DrinkTemp = "hot" | "cold";
type DrinkSelection = `${"coffee" | "tea"}-${DrinkTemp}` | null;

const DRINKS: { id: "coffee" | "tea"; index: string; en: string; ko: string; bg: string }[] = [
  { id: "coffee", index: "01", en: "Coffee", ko: "커피", bg: "bg-stone-900" },
  { id: "tea", index: "02", en: "Tea", ko: "차", bg: "bg-forest-700" },
];

function DrinkSlide() {
  const [selection, setSelection] = useState<DrinkSelection>(null);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-stone-100 py-8 pr-24 pl-8 sm:pr-32 sm:pl-16">
        <div>
          <Eyebrow>A Drink Before We Begin</Eyebrow>
          <Heading className="mt-2 text-stone-900">Choose one.</Heading>
        </div>
        <div className="text-right text-sm text-stone-500">
          <p>Hot or cold — just tell your therapist.</p>
          <p className="text-stone-400">따뜻하게 또는 차갑게, 편하게 말씀해 주세요.</p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        {DRINKS.map((drink) => (
          <div key={drink.id} className={`flex flex-col justify-center gap-8 px-8 py-10 sm:px-16 ${drink.bg}`}>
            <div>
              <p className="font-[family-name:var(--font-display)] text-sm text-stone-300 italic">{drink.index}</p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-5xl font-semibold text-white">
                {drink.en}
              </h3>
              <p className="mt-1 text-base text-stone-300">{drink.ko}</p>
            </div>
            <div className="flex gap-3">
              {(["hot", "cold"] as const).map((temp) => {
                const key: DrinkSelection = `${drink.id}-${temp}`;
                const active = selection === key;
                return (
                  <button
                    key={temp}
                    type="button"
                    onClick={() => setSelection(key)}
                    aria-pressed={active}
                    className={`rounded-full border px-6 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                      active
                        ? "border-transparent bg-white text-stone-900"
                        : "border-white/40 text-white hover:border-white"
                    }`}
                  >
                    {temp === "hot" ? "Hot 따뜻하게" : "Cold 차갑게"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const BEFORE_LINES = [
  { en: "Tell us if any areas feel especially tired.", ko: "특별히 피곤한 곳이 있다면 알려주세요." },
  { en: "Let us know if you prefer stronger or softer pressure.", ko: "원하시는 압의 세기를 말씀해 주세요." },
  { en: "Your comfort matters more than staying quiet.", ko: "불편함을 참지 않으셔도 괜찮습니다." },
];

function BeforeWeBeginSlide() {
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center bg-stone-100 px-8 py-12 sm:px-16">
        <Eyebrow>Before Your Treatment</Eyebrow>
        <Heading className="mt-3 text-stone-900">Before we begin</Heading>
        <p className="mt-6 font-[family-name:var(--font-display)] text-xl text-forest-700 italic">
          Please tell us anytime.
        </p>
        <p className="mt-1 text-sm text-stone-500">언제든지 편하게 말씀해 주세요.</p>
      </div>
      <div className="flex flex-col justify-center gap-6 bg-stone-50 px-8 py-12 sm:px-16">
        {BEFORE_LINES.map((line, i) => (
          <div key={line.en} className={i < BEFORE_LINES.length - 1 ? "border-b border-stone-200 pb-6" : ""}>
            <p className="text-lg text-stone-800">{line.en}</p>
            <p className="mt-1 text-sm text-stone-400">{line.ko}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const COMFORT_PHRASES = [
  { en: "More Pressure", ko: "조금 더 세게 해주세요" },
  { en: "Less Pressure", ko: "조금 더 약하게 해주세요" },
  { en: "Please Focus Here", ko: "여기를 더 신경 써주세요" },
  { en: "Too Hot", ko: "너무 뜨거워요" },
  { en: "Too Cold", ko: "너무 차가워요" },
  { en: "I'm Comfortable", ko: "지금 딱 좋아요" },
];

function ComfortPhrasesSlide() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="flex h-full w-full flex-col justify-center bg-stone-50 px-8 py-10 sm:px-16">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading className="text-stone-900">Make yourself comfortable.</Heading>
        <p className="text-sm text-stone-500">A few simple words are enough.</p>
      </div>
      <p className="mt-1 text-sm text-stone-400">화면을 눌러 치료사에게 알려주세요.</p>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {COMFORT_PHRASES.map((phrase, i) => {
          const active = selected.has(i);
          return (
            <button
              key={phrase.en}
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={active}
              className={`min-h-24 rounded-lg border px-5 py-4 text-left transition-colors ${
                active
                  ? "border-forest-600 bg-forest-600 text-white"
                  : "border-stone-300 bg-white text-stone-800 hover:border-forest-400"
              }`}
            >
              <span className="block text-base font-semibold tracking-wide uppercase">{phrase.en}</span>
              <span className={`mt-1 block text-sm ${active ? "text-forest-50" : "text-stone-400"}`}>
                {phrase.ko}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MENU_PROMPTS: Record<string, string> = {
  "aroma-oil": "I want to relax",
  "hot-stone": "I like warmth",
  "thai-massage": "I want stretching",
  "quick-spa-foot": "My feet are tired",
  facial: "I want facial care",
};

function MenuSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center overflow-y-auto bg-stone-50 px-8 py-10 sm:px-16">
      <Eyebrow>Our Treatments</Eyebrow>
      <Heading className="mt-3 text-stone-900">
        Choose the treatment
        <br />
        that fits your day.
      </Heading>
      <div className="mt-8 divide-y divide-stone-200 border-t border-stone-200">
        {treatmentShowcase.map((item) => {
          const durations = item.options
            .map((o) => getServiceOption(o.optionId)?.durationMinutes)
            .filter((d): d is number => typeof d === "number");
          const image = serviceImages[item.serviceId];
          const name = serviceCopy[item.translationKey]?.name ?? item.serviceId;

          return (
            <div key={item.serviceId} className="flex items-center gap-4 py-4">
              {image && (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md sm:h-16 sm:w-16">
                  <Image src={image} alt={item.imageAlt} fill className="object-cover" sizes="64px" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-400">{MENU_PROMPTS[item.serviceId]}</p>
                <p className="truncate text-base font-semibold text-stone-900 sm:text-lg">{name}</p>
              </div>
              <p className="shrink-0 text-sm text-stone-500">{durations.join(" / ")} min</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreatmentOptionRow({
  durationMinutes,
  price,
  includes,
  mostPopular,
}: {
  durationMinutes: number;
  price: number;
  includes: string[];
  mostPopular?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-200 py-3 last:border-0">
      <div className="min-w-0">
        <span className="text-base font-medium text-stone-900">{durationMinutes} min</span>
        {includes.length > 0 && <span className="ml-2 text-sm text-stone-500">{includes.join(" · ")}</span>}
        {mostPopular && (
          <span className="ml-2 text-xs font-semibold tracking-wide text-forest-600 uppercase">★ Most Popular</span>
        )}
      </div>
      <span className="shrink-0 text-base font-semibold whitespace-nowrap text-stone-900">{formatKrw(price)}</span>
    </div>
  );
}

function TreatmentDetailSlide({
  indexLabel,
  translationKey,
  serviceId,
  options,
  showEveryCourseIncludes,
  imageAlt,
  comparisonChips,
}: {
  indexLabel: string;
  translationKey: string;
  serviceId: string;
  options: { optionId: string; mostPopular?: boolean }[];
  showEveryCourseIncludes?: boolean;
  imageAlt: string;
  comparisonChips?: { name: string; tagline: string }[];
}) {
  const copy = showcaseCopy[translationKey];
  const name = serviceCopy[translationKey]?.name ?? serviceId;
  const image = serviceImages[serviceId];

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      {image && (
        <div className="relative hidden md:block">
          <Image src={image} alt={imageAlt} fill className="object-cover" sizes="50vw" />
        </div>
      )}
      <div className="flex flex-col justify-center overflow-y-auto px-8 py-10 sm:px-16">
        <p className="text-xs font-medium tracking-[0.3em] text-forest-600 uppercase">{indexLabel}</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-stone-900 sm:text-5xl">
          {name}
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-stone-600">{copy.description}</p>

        <div className="mt-8 max-w-md">
          {options.map((opt) => {
            const option = getServiceOption(opt.optionId);
            if (!option) return null;
            return (
              <TreatmentOptionRow
                key={opt.optionId}
                durationMinutes={option.durationMinutes}
                price={option.pricePerPerson}
                includes={copy.options[String(option.durationMinutes)] ?? []}
                mostPopular={opt.mostPopular}
              />
            );
          })}
        </div>

        {showEveryCourseIncludes && copy.everyCourseIncludes && (
          <p className="mt-6 text-sm text-stone-500">
            <span className="mr-1 font-medium tracking-wide text-stone-400 uppercase">Every Course</span>
            {copy.everyCourseIncludes.join(" · ")}
          </p>
        )}
        <p className="mt-2 text-sm text-stone-500">
          <span className="mr-1 font-medium tracking-wide text-stone-400 uppercase">Best For</span>
          {copy.bestFor.join(" · ")}
        </p>
        {copy.tagline && (
          <p className="mt-6 font-[family-name:var(--font-display)] text-lg text-forest-700 italic">
            {copy.tagline}
          </p>
        )}

        {comparisonChips && (
          <div className="mt-8 flex gap-6 border-t border-stone-200 pt-6">
            {comparisonChips.map((chip) => (
              <div key={chip.name}>
                <p className="text-sm font-semibold text-stone-800">{chip.name}</p>
                <p className="text-xs text-stone-400">{chip.tagline}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickCareSlide() {
  const items = treatmentShowcase.filter((i) => i.serviceId === "quick-spa-foot" || i.serviceId === "facial");

  return (
    <div className="flex h-full w-full flex-col justify-center overflow-y-auto bg-stone-50 px-8 py-10 sm:px-16">
      <Eyebrow>04 · Quick Care</Eyebrow>
      <Heading className="mt-3 text-stone-900">Shorter treatments, easy to enjoy.</Heading>
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {items.map((item) => {
          const copy = showcaseCopy[item.translationKey];
          const name = serviceCopy[item.translationKey]?.name ?? item.serviceId;
          const image = serviceImages[item.serviceId];
          const option = getServiceOption(item.options[0].optionId);

          return (
            <div key={item.serviceId} className="flex flex-col">
              {image && (
                <div className="relative h-40 w-full overflow-hidden rounded-lg sm:h-48">
                  <Image src={image} alt={item.imageAlt} fill className="object-cover" sizes="(min-width: 640px) 45vw, 90vw" />
                </div>
              )}
              <p className="mt-4 text-lg font-semibold text-stone-900">{name}</p>
              {option && (
                <p className="text-sm text-stone-500">
                  {option.durationMinutes} min — {formatKrw(option.pricePerPerson)}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{copy.description}</p>
              <p className="mt-3 text-xs text-stone-400">
                <span className="mr-1 font-medium tracking-wide uppercase">Best For</span>
                {copy.bestFor.join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AMBIENCE_IMAGES = [
  { src: ambienceInterior, alt: "Woori Aroma treatment room, warm lighting" },
  { src: ambienceProducts, alt: "Woori Aroma tea and amenities display" },
  { src: ambienceExterior, alt: "Woori Aroma deck garden" },
];

function AmbienceSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-stone-800 px-8 py-10 sm:px-16">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-stone-50 sm:text-4xl">
          A little quieter. A little slower.
        </h2>
        <p className="text-right text-sm text-stone-300">
          warm wood · aroma · soft lighting
          <br />
          quiet music · warm foot bath · personal care
        </p>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {AMBIENCE_IMAGES.map((img) => (
          <div key={img.alt} className="relative aspect-[4/3] overflow-hidden rounded-md">
            <Image src={img.src} alt={img.alt} fill className="object-cover" sizes="33vw" />
          </div>
        ))}
      </div>
    </div>
  );
}

type BodyMark = "none" | "attention" | "careful";

const BODY_PARTS = [
  { n: 1, en: "Neck & Shoulders", ko: "목 · 어깨" },
  { n: 2, en: "Arms & Hands", ko: "팔 · 손" },
  { n: 3, en: "Back", ko: "등" },
  { n: 4, en: "Lower Back", ko: "허리" },
  { n: 5, en: "Legs", ko: "다리" },
  { n: 6, en: "Feet", ko: "발" },
];

function nextBodyMark(mark: BodyMark): BodyMark {
  if (mark === "none") return "attention";
  if (mark === "attention") return "careful";
  return "none";
}

function bodyMarkColor(mark: BodyMark): string {
  if (mark === "attention") return "#f59e0b"; // amber-500 — "more attention here"
  if (mark === "careful") return "#e11d48"; // rose-600 — "please be careful here"
  return "#434c35"; // forest-700 — unmarked default
}

function bodyBadge(n: number, x: number, y: number, marks: Record<number, BodyMark>): ReactNode {
  return (
    <g key={n}>
      <circle cx={x} cy={y} r={10} fill={bodyMarkColor(marks[n] ?? "none")} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">
        {n}
      </text>
    </g>
  );
}

function BodyDiagram({ marks }: { marks: Record<number, BodyMark> }) {
  return (
    <svg viewBox="0 0 240 190" className="h-56 w-auto sm:h-64" role="img" aria-label="Front and back body diagram">
      <g fill="#faf6ee" stroke="#d4bd91" strokeWidth="1.5">
        {/* front */}
        <circle cx="50" cy="18" r="14" />
        <rect x="30" y="34" width="40" height="56" rx="18" />
        <rect x="10" y="36" width="14" height="66" rx="7" />
        <rect x="76" y="36" width="14" height="66" rx="7" />
        <rect x="31" y="88" width="16" height="62" rx="8" />
        <rect x="53" y="88" width="16" height="62" rx="8" />
        {/* back */}
        <circle cx="190" cy="18" r="14" />
        <rect x="168" y="34" width="44" height="56" rx="18" />
        <rect x="148" y="36" width="14" height="66" rx="7" />
        <rect x="218" y="36" width="14" height="66" rx="7" />
        <rect x="171" y="88" width="16" height="62" rx="8" />
        <rect x="193" y="88" width="16" height="62" rx="8" />
      </g>
      {bodyBadge(1, 50, 30, marks)}
      {bodyBadge(2, 17, 65, marks)}
      {bodyBadge(5, 39, 120, marks)}
      {bodyBadge(3, 190, 55, marks)}
      {bodyBadge(4, 190, 90, marks)}
      {bodyBadge(6, 179, 145, marks)}
    </svg>
  );
}

function PointItOutSlide() {
  const [marks, setMarks] = useState<Record<number, BodyMark>>({});

  function toggle(n: number) {
    setMarks((prev) => ({ ...prev, [n]: nextBodyMark(prev[n] ?? "none") }));
  }

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center overflow-y-auto bg-stone-50 px-8 py-10 sm:px-16">
        <Eyebrow>Point It Out</Eyebrow>
        <Heading className="mt-3 text-stone-900">Show us where.</Heading>
        <p className="mt-3 text-base text-stone-600">Point to the diagram, or say the number.</p>
        <p className="text-sm text-stone-400">그림에서 짚어 주시거나 번호로 말씀해 주세요.</p>

        <div className="mt-5 flex flex-col gap-2 text-sm text-stone-600">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            More attention here <span className="text-stone-400">더 받고 싶은 곳</span>
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600" />
            Please be careful here <span className="text-stone-400">조심해야 할 곳</span>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {BODY_PARTS.map((part) => {
            const mark = marks[part.n] ?? "none";
            return (
              <button
                key={part.n}
                type="button"
                onClick={() => toggle(part.n)}
                aria-pressed={mark !== "none"}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  mark === "attention"
                    ? "border-amber-500 bg-amber-50"
                    : mark === "careful"
                      ? "border-rose-500 bg-rose-50"
                      : "border-stone-200 bg-white hover:border-forest-400"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: bodyMarkColor(mark) }}
                >
                  {part.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800">{part.en}</span>
                  <span className="block text-xs text-stone-400">{part.ko}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 bg-stone-100 px-8 py-10">
        <BodyDiagram marks={marks} />
        <div className="flex gap-20 text-xs font-medium tracking-[0.2em] text-stone-500 uppercase">
          <span>Front 앞</span>
          <span>Back 뒤</span>
        </div>
      </div>
    </div>
  );
}

function AfterTreatmentSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-stone-50 px-8 text-center">
      <Eyebrow>After Your Treatment</Eyebrow>
      <Heading className="mt-3 text-stone-900">Take your time.</Heading>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-stone-600">
        Take a moment to breathe, drink some water, and enjoy the feeling before returning to your Jeju journey.
      </p>
      <p className="mt-2 text-sm text-stone-400">서두르지 않으셔도 됩니다. 천천히 나오세요.</p>
    </div>
  );
}

function ClosingSlide() {
  return (
    <div className="relative h-full w-full">
      <Image src={closingImage} alt="Woori Aroma exterior" fill className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-white sm:text-5xl">
          Enjoy the rest of
          <br />
          your journey in Jeju.
        </h2>
        <p className="mt-4 text-sm text-stone-200">조용한 시간을 저희와 함께해 주셔서 감사합니다.</p>
        <div className="mt-8 text-sm text-stone-300">
          <p className="text-xs font-medium tracking-[0.3em] text-stone-400 uppercase">{BUSINESS.name} · Jeju</p>
          {BUSINESS.addressLines.map((line) => (
            <p key={line} className="mt-1">
              {line}
            </p>
          ))}
          <p className="mt-3">
            {BUSINESS.phone} · {BUSINESS.instagramHandle}
          </p>
        </div>
        <p className="mt-6 text-sm text-stone-300 italic">Private wellness in Jeju — one group at a time.</p>
      </div>
    </div>
  );
}

const aromaOilItem = treatmentShowcase.find((i) => i.serviceId === "aroma-oil")!;
const hotStoneItem = treatmentShowcase.find((i) => i.serviceId === "hot-stone")!;
const thaiItem = treatmentShowcase.find((i) => i.serviceId === "thai-massage")!;

const SLIDES: ReactNode[] = [
  <HeroSlide key="hero" />,
  <SlowDownSlide key="slow-down" />,
  <AboutSlide key="about" />,
  <SpaceTimeSlide key="space-time" />,
  <NextStepsSlide key="next-steps" />,
  <MenuSlide key="menu" />,
  <TreatmentDetailSlide
    key="aroma-oil"
    indexLabel="01 · Relax"
    translationKey="aromaOil"
    serviceId="aroma-oil"
    options={aromaOilItem.options}
    showEveryCourseIncludes
    imageAlt={aromaOilItem.imageAlt}
  />,
  <TreatmentDetailSlide
    key="hot-stone"
    indexLabel="02 · Warmth"
    translationKey="hotStone"
    serviceId="hot-stone"
    options={hotStoneItem.options}
    showEveryCourseIncludes
    imageAlt={hotStoneItem.imageAlt}
  />,
  <TreatmentDetailSlide
    key="thai-massage"
    indexLabel="03 · Stretch"
    translationKey="thaiMassage"
    serviceId="thai-massage"
    options={thaiItem.options}
    imageAlt={thaiItem.imageAlt}
    comparisonChips={[
      { name: "Thai Massage", tagline: "Stretching · Pressure · Active" },
      { name: "Aroma Oil Massage", tagline: "Oil · Relaxation · Gentle" },
    ]}
  />,
  <QuickCareSlide key="quick-care" />,
  <DrinkSlide key="drink" />,
  <BeforeWeBeginSlide key="before-we-begin" />,
  <ComfortPhrasesSlide key="comfort-phrases" />,
  <PointItOutSlide key="point-it-out" />,
  <AmbienceSlide key="ambience" />,
  <AfterTreatmentSlide key="after-treatment" />,
  <ClosingSlide key="closing" />,
];

export function WelcomeGuide() {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const total = SLIDES.length;

  const goTo = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(total - 1, i)));
    },
    [total],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (event.key === "Home") setIndex(0);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 60) return;
    goTo(delta < 0 ? index + 1 : index - 1);
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-stone-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <div key={i} className="h-full w-full shrink-0">
            {slide}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(index - 1)}
        disabled={index === 0}
        aria-label="Previous slide"
        className="absolute top-1/2 left-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-xl text-white backdrop-blur-sm transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:left-5"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        disabled={index === total - 1}
        aria-label="Next slide"
        className="absolute top-1/2 right-3 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-xl text-white backdrop-blur-sm transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:right-5"
      >
        ›
      </button>

      <button
        type="button"
        onClick={() => goTo(0)}
        aria-label="Restart from the beginning"
        className="absolute top-4 right-4 rounded-full bg-black/30 px-4 py-2 text-xs font-medium tracking-wide text-white backdrop-blur-sm"
      >
        ↺ Restart
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
