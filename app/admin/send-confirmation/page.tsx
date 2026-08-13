import Link from "next/link";
import { resolveEmailDeliveryMode } from "@/lib/notifications/recipientPolicy";
import { ReservationSearchBox } from "@/components/admin/ReservationSearchBox";
import { ManualConfirmationComposer } from "@/components/admin/ManualConfirmationComposer";

export default function SendConfirmationPage() {
  const deliveryMode = resolveEmailDeliveryMode();
  const testRecipientConfigured = Boolean(process.env.EMAIL_TEST_RECIPIENT);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">메일 보내기</h1>
        <Link href="/admin" className="text-sm text-stone-600 hover:underline">
          ← 대시보드
        </Link>
      </div>

      <ReservationSearchBox />

      <div className="flex items-center gap-3 text-xs text-stone-400">
        <div className="h-px flex-1 bg-stone-200" />
        예약 시스템에 없는 경우 직접 입력
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <ManualConfirmationComposer deliveryMode={deliveryMode} testRecipientConfigured={testRecipientConfigured} />
    </main>
  );
}
