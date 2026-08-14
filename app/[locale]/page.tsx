import { getTranslations, setRequestLocale } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { treatmentShowcase } from "@/data/treatmentShowcase";
import { serviceImages } from "@/data/media";
import { Hero } from "@/components/marketing/Hero";
import { TreatmentCard } from "@/components/marketing/TreatmentCard";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const tServices = await getTranslations("services");
  const tShowcase = await getTranslations("treatmentShowcase");
  const tCommon = await getTranslations("common");
  const tFooter = await getTranslations("footer");

  return (
    <main className="flex flex-1 flex-col">
      <Hero />

      {/* Treatments */}
      <section className="bg-stone-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900 sm:text-3xl">
            {t("treatmentsHeading")}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-600">
            {t("treatmentsSubheading")}
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {treatmentShowcase.map((item) => {
              const service = getService(item.serviceId);
              const image = serviceImages[item.serviceId];
              if (!service || !image) return null;

              const options = item.options
                .map((entry) => {
                  const option = getServiceOption(entry.optionId);
                  if (!option) return null;
                  return {
                    durationMinutes: option.durationMinutes,
                    price: option.pricePerPerson,
                    contents: tShowcase.raw(`${item.translationKey}.options.${option.durationMinutes}`) as string[],
                    mostPopular: Boolean(entry.mostPopular),
                  };
                })
                .filter((option): option is NonNullable<typeof option> => option !== null);

              const everyCourseIncludes = item.hasEveryCourseIncludes
                ? (tShowcase.raw(`${item.translationKey}.everyCourseIncludes`) as string[])
                : undefined;
              const tagline = item.hasTagline ? tShowcase(`${item.translationKey}.tagline`) : undefined;

              return (
                <TreatmentCard
                  key={service.id}
                  image={image}
                  imageAlt={item.imageAlt}
                  name={tServices(service.nameKey.replace("services.", ""))}
                  description={tShowcase(`${item.translationKey}.description`)}
                  tagline={tagline}
                  options={options}
                  everyCourseLabel={tShowcase("everyCourseLabel")}
                  everyCourseIncludes={everyCourseIncludes}
                  includesLabel={tShowcase("includesLabel")}
                  bestForLabel={tShowcase("bestForLabel")}
                  bestFor={tShowcase.raw(`${item.translationKey}.bestFor`) as string[]}
                  mostPopularLabel={tShowcase("mostPopularLabel")}
                  minLabel={tCommon("min")}
                />
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter
        heading={tFooter("heading")}
        tagline={tFooter("tagline")}
        mapsCta={tFooter("mapsCta")}
        instagramLabel={tFooter("instagram")}
      />
    </main>
  );
}
