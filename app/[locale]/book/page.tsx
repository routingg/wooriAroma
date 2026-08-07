import { setRequestLocale } from "next-intl/server";
import { BookingProvider } from "@/components/booking/BookingProvider";
import { BookingWizard } from "@/components/booking/BookingWizard";

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <BookingProvider>
      <BookingWizard />
    </BookingProvider>
  );
}
