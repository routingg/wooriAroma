import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBookableServices } from "@/data/services";

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
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
        <p className="text-xs font-medium tracking-[0.25em] text-stone-500">
          {t("kicker")}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          {t("brand")}
        </h1>
        <p className="mt-8 max-w-md text-balance text-lg leading-relaxed text-stone-700 sm:text-xl">
          {t("heroLine1")}
          <br />
          {t("heroLine2")}
        </p>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-white/70 px-6 py-4">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-stone-900">
            {t("tagline")}
          </p>
          <p className="mt-1 text-sm text-stone-600">{t("capacity")}</p>
        </div>

        <Link
          href="/book"
          className="mt-10 inline-flex min-h-14 w-full max-w-xs items-center justify-center rounded-full bg-stone-900 px-8 text-base font-medium text-stone-50 shadow-sm transition-colors hover:bg-stone-800 sm:w-auto"
        >
          {t("cta")}
        </Link>
      </section>

      <section className="border-t border-stone-200 bg-white px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold text-stone-900">
            {t("treatmentsHeading")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-stone-600">
            {t("treatmentsSubheading")}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-stone-900">
                  {/* nameKey is e.g. "services.aromaOil.name" — strip the "services." prefix for the services-scoped translator */}
                  {tServices(service.nameKey.replace("services.", ""))}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {tServices(service.descriptionKey.replace("services.", ""))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-stone-50 px-6 py-8 text-center">
        <p className="text-xs tracking-wide text-stone-400">{t("footerNote")}</p>
      </footer>
    </main>
  );
}
