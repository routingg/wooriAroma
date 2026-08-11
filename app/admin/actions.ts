"use server";

import { revalidatePath } from "next/cache";
import { updateStatus, type ReservationStatus } from "@/lib/repositories/reservationRepository";
import { createBlockedTime, removeBlockedTime } from "@/lib/repositories/blockedTimeRepository";
import { resolveHandoff } from "@/lib/repositories/agentHandoffRepository";

/** Status changes only — never physically deletes reservation history (AGENTS.md §12.2). */
export async function updateReservationStatusAction(id: string, status: ReservationStatus) {
  updateStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/reservations");
}

export async function createBlockedTimeAction(formData: FormData) {
  const dateKey = String(formData.get("dateKey") ?? "");
  if (!dateKey) return;

  const fullDay = formData.get("fullDay") === "on";
  const startTime = String(formData.get("startTime") ?? "10:00");
  const endTime = String(formData.get("endTime") ?? "21:00");
  const reasonRaw = String(formData.get("reason") ?? "").trim();

  createBlockedTime({ dateKey, startTime, endTime, fullDay, reason: reasonRaw || undefined });
  revalidatePath("/admin/blocked-times");
  revalidatePath("/admin");
}

export async function removeBlockedTimeAction(id: string) {
  removeBlockedTime(id);
  revalidatePath("/admin/blocked-times");
  revalidatePath("/admin");
}

export async function resolveHandoffAction(id: string, formData: FormData) {
  const adminNotes = String(formData.get("adminNotes") ?? "").trim() || undefined;
  resolveHandoff(id, adminNotes);
  revalidatePath("/admin/agent-handoffs");
}
