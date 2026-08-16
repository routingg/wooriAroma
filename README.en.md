# Woori Aroma Booking System

[한국어](./README.md) | [English](./README.en.md) | [中文](./README.zh.md)

Private spa reservation platform for Woori Aroma (Jungmun, Jeju). See `proposal.md`
for the full product/architecture spec, and `report.md` for the development log.

**Live: [https://wooriaroma.site](https://wooriaroma.site) (www.wooriaroma.site)** — deployed
on Cloudflare Workers (`wrangler.jsonc`).

## Requirements

- Node.js **>= 22.5.0** (see `package.json`'s `engines`)

## Getting Started

```bash
npm install
wrangler d1 migrations apply woori-aroma-db --local   # seed the local D1 schema (once)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the customer booking site
(`/en`, `/ko`, `/zh`, `/ja`) or [http://localhost:3000/admin](http://localhost:3000/admin)
for the Korean-only admin dashboard.

No environment variables are needed to reach the database — `next.config.ts`'s
`initOpenNextCloudflareForDev()` wires up a local Cloudflare D1 binding automatically
(the migration command above is a one-time setup step). Email delivery is safely
skipped when no provider is configured. Copy `.env.example` to `.env.local` only once
a real email provider is being wired up.

**⚠️ `/admin` is protected by HTTP Basic Auth.** It's fail-closed — if
`ADMIN_BASIC_AUTH_USER`/`ADMIN_BASIC_AUTH_PASSWORD` aren't set, every request is
refused, so local development needs these too — see `.env.example`.

## Scripts

```bash
npm run dev        # start the dev server
npm run build       # production build
npm run start        # run the production build
npm run lint          # eslint
npm run typecheck      # tsc --noEmit
npm test                # vitest — domain logic, API routes, admin features, agent tools
npm run cf:preview        # OpenNext build + local Cloudflare preview
npm run cf:deploy          # OpenNext build + Cloudflare deploy
```

## Project layout

```text
app/[locale]/book/    customer booking wizard (next-intl routed)
app/admin/             Korean-only admin dashboard (no locale routing)
app/api/                 booking API route handlers
app/api/cron/reminders/    24h reminder trigger (external scheduler calls this)
lib/booking/               pure domain logic (availability, pricing, validation)
lib/admin/                   admin-only logic (confirmation email copy generation, status/labels, delete eligibility)
lib/notifications/           multi-channel notification service (see below)
lib/db/                     Cloudflare D1 client + migrations
lib/repositories/             DB access, one file per table/aggregate
lib/agent/                     Gemini agent tool layer (Function Calling wired up)
data/services.ts                  treatment catalog (source of truth for pricing)
messages/{en,ko,zh,ja}.json          customer-facing translations
tests/                                 vitest suite
```

## Reservation & Email Workflow

Submitting a reservation does not confirm it immediately. There is no deposit —
the customer only submits a request, and payment happens in person at the spa.

```text
Customer submits a reservation request (no payment)
        │
        ▼
Status: PENDING (예약 대기)  ← a "Reservation Request Received" email
                                is sent automatically at this point
        │
        ▼
Admin reviews the schedule and changes the status to CONFIRMED (예약 확정)
        │
        ▼
Admin reviews/edits the confirmation email copy on /admin/reservations,
then copies either the plain-text version or the designed HTML version
        │
        ▼
Admin sends it manually from Gmail (or any email client)
        │
        ▼
Admin manually marks it as "발송 완료" (sent) — tracked separately from reservation status
```

Once a reservation reaches **COMPLETED, CANCELLED, or NO_SHOW**, an admin can delete
it from the working list. This is a soft delete (`deleted_at`) — the underlying
database row is never removed, so history is preserved; it's only excluded from the
normal lists, search, and dashboard stats.

## Notification System

`lib/notifications/service.ts` is the single place that knows about the email
provider (Resend) — reservation domain code never calls it directly. Every send
attempt — sent, failed, or skipped — is logged to the `notifications` table
(`lib/repositories/notificationRepository.ts`) keyed by `(reservation, channel, event)`,
which is also what makes the 24h reminder job idempotent.

### Emails sent automatically

| When | Event |
|---|---|
| Customer submits a reservation | Request received (`RESERVATION_REQUEST_RECEIVED`) |
| Admin cancels a CONFIRMED reservation | Cancellation notice (`RESERVATION_CANCELLED`) |
| 24h before the visit (cron) | Reminder (`RESERVATION_REMINDER`) |

### Emails sent manually only

- **The confirmation email (`RESERVATION_CONFIRMED`) is never sent automatically for
  online reservations.** The "메일 작성" (compose email) panel on
  `/admin/reservations/[id]` prepares editable plain-text and designed-HTML versions
  that the admin reviews, edits if needed, copies, and sends by hand from Gmail or
  similar. The system never sends this email on the admin's behalf.
- Manual/offline bookings that aren't linked to an online reservation (e.g. phone
  bookings) can still be sent immediately from `/admin/send-confirmation` — that
  screen still sends for real, through Resend.

### Required environment variables (all server-only, see `.env.example`)

| Channel | Variables |
|---|---|
| Email — Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Email delivery safety gate | `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENT` |
| Reminder cron | `CRON_SECRET` |

None of these are required for local development — the email provider degrades to a
logged `provider_not_configured` skip.

### Registering each provider

- **Resend**: create an account at resend.com, verify a sending domain, create an API key.
- **Email delivery safety gate**: `EMAIL_DELIVERY_MODE` defaults to `sandbox` unless set
  to exactly `production` (any unset/misspelled value stays in sandbox — see
  `lib/notifications/recipientPolicy.ts`). In sandbox mode, every automatically-sent
  email (request received / cancellation / reminder) and every manual send from
  `/admin/send-confirmation` is redirected to `EMAIL_TEST_RECIPIENT` instead of the
  real customer address, and is skipped entirely if that variable isn't set. The
  "Send Test Email" button always targets `EMAIL_TEST_RECIPIENT` regardless of
  delivery mode.
- **Reminder cron**: generate any long random string for `CRON_SECRET`, then point an
  external scheduler at `POST /api/cron/reminders` with header
  `Authorization: Bearer <CRON_SECRET>`. Any scheduler works — a Vercel Cron entry, a
  plain server crontab running `curl`, a GitHub Actions scheduled workflow. Run it at
  least hourly; the job is idempotent so more frequent runs are harmless.

Automatically-sent emails (request received / cancellation / reminder) embed the
directions map at `public/sketchmap.png` as an inline attachment
(`lib/notifications/mapAttachment.ts`). Cancellation emails omit it by default.

### Known limitations

- `RESERVATION_UPDATED` has no real trigger yet — the codebase has no
  reservation-edit/reschedule feature to hang it off of. The event type, templates,
  and provider wiring all already support it; it just isn't called anywhere today.

## Learn More

This project uses [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS + `next-intl`,
deployed on Cloudflare Workers (`@opennextjs/cloudflare` + Wrangler) with Cloudflare D1. See
`report.md` for the development log and deployment details.
