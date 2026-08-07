import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBookableServices } from "@/data/services";
import { heroImage, media, serviceImages } from "@/data/media";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const tServices = await getTranslations("services");
  const services = getBookableServices();

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero — real spa interior, warm scrim, brand overlay */}
      <section className="relative flex min-h-[80svh] items-end overflow-hidden sm:min-h-[80vh]">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[center_75%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-stone-900/85 via-stone-900/35 to-stone-900/10"
        />

        <div className="relative w-full px-6 pb-12 pt-24 sm:px-10 sm:pb-16">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-medium tracking-[0.3em] text-stone-100/80">
              {t("kicker")}
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-stone-50 sm:text-6xl">
              {t("brand")}
            </h1>
            <p className="mt-6 max-w-md text-balance text-lg leading-relaxed text-stone-100 sm:text-xl">
              {t("heroLine1")}
              <br />
              {t("heroLine2")}
            </p>
            <p className="mt-5 font-[family-name:var(--font-display)] text-xl font-semibold text-stone-50">
              {t("tagline")}
              <span className="ml-2 font-sans text-sm font-normal text-stone-100/80">
                {t("capacity")}
              </span>
            </p>

            <Link
              href="/book"
              className="mt-8 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-full bg-stone-50 px-8 text-base font-medium text-stone-900 shadow-lg shadow-stone-900/20 transition-colors hover:bg-stone-100 sm:w-auto"
            >
              {t("cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* Treatments */}
      <section className="bg-stone-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900 sm:text-3xl">
            {t("treatmentsHeading")}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-600">
            {t("treatmentsSubheading")}
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {services.map((service) => {
              const image = serviceImages[service.id];
              return (
                <div key={service.id} className="group">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200">
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        placeholder="blur"
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900">
                    {tServices(service.nameKey.replace("services.", ""))}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                    {tServices(service.descriptionKey.replace("services.", ""))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Location strip */}
      <section className="relative flex min-h-[40vh] items-center overflow-hidden">
        <Image
          src={media.exterior}
          alt=""
          fill
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-stone-900/55" />
        <p className="relative mx-auto px-6 text-center text-sm tracking-wide text-stone-50">
          {t("footerNote")}
        </p>
      </section>
    </main>
  );
}
