"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteReservationAction } from "@/app/admin/actions";
import { DELETABLE_RESERVATION_STATUSES } from "@/lib/admin/labels";
import type { ReservationStatus } from "@/lib/repositories/reservationRepository";

interface DeleteReservationButtonProps {
  reservationId: string;
  status: ReservationStatus;
  deletedAt: string | null;
  customerName: string;
  dateTimeLabel: string;
  serviceLabel: string;
  guestCount: number;
  /** Detail page only: navigate away after a successful delete instead of relying on revalidation to update the current view (AGENTS.md §13). */
  redirectAfterDeleteTo?: string;
}

/**
 * 완료/취소/노쇼(DELETABLE_RESERVATION_STATUSES) 예약에서만 렌더링됨 —
 * 클라이언트 쪽 조건은 방어적 표시일 뿐이고, 실제 자격 검증은 서버의
 * softDeleteReservation()이 다시 수행합니다 (AGENTS.md §4/§17). 예약
 * 취소(예약 상태 변경)와는 완전히 별개의 기능입니다 (§21) — 여기서 상태를
 * 건드리지 않습니다.
 */
export function DeleteReservationButton({
  reservationId,
  status,
  deletedAt,
  customerName,
  dateTimeLabel,
  serviceLabel,
  guestCount,
  redirectAfterDeleteTo,
}: DeleteReservationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!DELETABLE_RESERVATION_STATUSES.includes(status) || deletedAt) return null;

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteReservationAction(reservationId);
      if (result.success) {
        setOpen(false);
        showToast("success", "예약이 삭제되었습니다.");
        if (redirectAfterDeleteTo) router.push(redirectAfterDeleteTo);
      } else {
        showToast("error", "예약을 삭제하지 못했습니다. 다시 시도해주세요.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
      >
        삭제
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="예약 삭제 확인"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-base font-semibold text-stone-900">예약을 삭제하시겠습니까?</p>

            <dl className="mt-4 flex flex-col gap-2.5 text-sm">
              {customerName && <SummaryRow label="고객" value={customerName} />}
              {dateTimeLabel && <SummaryRow label="예약일" value={dateTimeLabel} />}
              {serviceLabel && <SummaryRow label="관리" value={serviceLabel} />}
              {guestCount > 0 && <SummaryRow label="인원" value={`${guestCount}명`} />}
            </dl>

            <p className="mt-4 text-xs text-stone-500">삭제하면 기본 예약 목록에서 더 이상 표시되지 않습니다.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "삭제 중..." : "예약 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg ${
            toast.tone === "success" ? "bg-stone-900" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{value}</dd>
    </div>
  );
}
