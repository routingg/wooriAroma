"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { searchReservationsAction, type ReservationSearchResult } from "@/app/admin/send-confirmation/actions";
import { STATUS_LABELS_KO } from "@/lib/admin/labels";
import { formatTimeLabel } from "@/lib/booking/time";

/**
 * Searches existing reservations and links each result to the
 * already-built /admin/reservations/[id] confirmation flow, rather than
 * re-implementing that panel here — a selected reservation's fields stay
 * read-only and DB-backed there (see ConfirmationEmailPanel.tsx). This box
 * only exists to help the admin *find* that page quickly; the "직접 입력"
 * form below it is for reservations that don't exist in the database at all.
 */
export function ReservationSearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReservationSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function runSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    startTransition(async () => {
      const found = await searchReservationsAction(value);
      setResults(found);
      setHasSearched(true);
    });
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">예약 검색</h2>
      <p className="mt-1 text-sm text-stone-500">
        예약번호, 고객명, 이메일로 기존 예약을 찾아 확정 메일 화면으로 이동합니다.
      </p>
      <input
        type="text"
        value={query}
        onChange={(event) => runSearch(event.target.value)}
        placeholder="예: WA-20260813-003, yujeonglim"
        className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      {isPending && <p className="mt-2 text-xs text-stone-400">검색 중…</p>}

      {!isPending && hasSearched && (
        <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200">
          {results.length === 0 ? (
            <li className="p-3 text-sm text-stone-400">일치하는 예약이 없습니다.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/reservations/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-stone-50"
                >
                  <span>
                    <span className="font-medium text-stone-900">{r.reservationNumber}</span>
                    <span className="text-stone-500">
                      {" "}
                      · {r.customerName} · {r.dateKey} {formatTimeLabel(r.serviceStart, "ko")}
                    </span>
                  </span>
                  <span className="text-xs text-stone-400">{STATUS_LABELS_KO[r.status]} →</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
