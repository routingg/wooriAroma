import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { updateReservationStatusAction } from "@/app/admin/actions";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

/**
 * Status transitions only — deliberately separate from the 메일 작성
 * copy-paste panel (EmailComposer). Changing status to CONFIRMED here never
 * sends anything automatically; see app/admin/actions.ts's
 * updateReservationStatusAction. Shared between the reservation list and
 * detail pages so the two can never show different actions for the same
 * status.
 */
export function ReservationStatusActions({ reservation }: { reservation: ReservationRecord }) {
  if (reservation.status === "PENDING") {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        <form action={updateReservationStatusAction.bind(null, reservation.id, "CONFIRMED")}>
          <button
            type="submit"
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
          >
            확정으로 변경
          </button>
        </form>
        <form action={updateReservationStatusAction.bind(null, reservation.id, "CANCELLED")}>
          <ConfirmSubmitButton
            confirmMessage={`${reservation.reservationNumber} 예약을 취소할까요?`}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            취소
          </ConfirmSubmitButton>
        </form>
      </div>
    );
  }

  if (reservation.status !== "CONFIRMED") return null;

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <form action={updateReservationStatusAction.bind(null, reservation.id, "COMPLETED")}>
        <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100">
          완료 처리
        </button>
      </form>
      <form action={updateReservationStatusAction.bind(null, reservation.id, "NO_SHOW")}>
        <ConfirmSubmitButton
          confirmMessage={`${reservation.reservationNumber} 예약을 노쇼 처리할까요?`}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
        >
          노쇼 처리
        </ConfirmSubmitButton>
      </form>
      <form action={updateReservationStatusAction.bind(null, reservation.id, "CANCELLED")}>
        <ConfirmSubmitButton
          confirmMessage={`${reservation.reservationNumber} 예약을 취소할까요?`}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
        >
          취소
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
