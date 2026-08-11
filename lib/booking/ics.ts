import { SEOUL_TIME_ZONE } from "./timezone";
import { BUSINESS } from "@/lib/config/business";

/**
 * Builds a VEVENT with TZID=Asia/Seoul so calendar apps show the treatment
 * time correctly in Jeju regardless of the customer's device timezone — no
 * date library needed since every input is already a plain "HH:mm"/"YYYY-MM-DD" string.
 */
export function buildReservationIcs(input: {
  reservationNumber: string;
  treatmentName: string;
  dateKey: string;
  startTime: string;
  endTime: string;
}): string {
  const [y, m, d] = input.dateKey.split("-");
  const [sh, sm] = input.startTime.split(":");
  const [eh, em] = input.endTime.split(":");

  const dtStart = `${y}${m}${d}T${sh}${sm}00`;
  const dtEnd = `${y}${m}${d}T${eh}${em}00`;
  const dtStamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Woori Aroma//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${input.reservationNumber}@wooriaroma`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${SEOUL_TIME_ZONE}:${dtStart}`,
    `DTEND;TZID=${SEOUL_TIME_ZONE}:${dtEnd}`,
    `SUMMARY:${BUSINESS.name} — ${input.treatmentName}`,
    `LOCATION:${BUSINESS.addressEn}`,
    `DESCRIPTION:Reservation ${input.reservationNumber}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
