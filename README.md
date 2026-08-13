# Woori Aroma Booking System

Private spa reservation platform for Woori Aroma (Jungmun, Jeju). See `proposal.md`
for the full product/architecture spec and `README2.md` for the original detailed
proposal (with an architecture-update note at the top).

## Requirements

- Node.js **>= 22.5.0** (uses the built-in `node:sqlite` module — see `package.json`'s `engines`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the customer booking site
(`/en`, `/ko`, `/zh`, `/ja`) or [http://localhost:3000/admin](http://localhost:3000/admin)
for the Korean-only admin dashboard.

No environment variables are required for local development — the app falls back to
a local SQLite database at `.data/woori-aroma.sqlite3` (gitignored) and mock
payment/notification providers. Copy `.env.example` to `.env.local` only once a real
payment/email/SMS provider is being wired up.

**⚠️ `/admin` has no authentication yet.** It is safe for local development but
must not be deployed publicly until auth is added — see `proposal.md` §11.

## Scripts

```bash
npm run dev        # start the dev server
npm run build       # production build
npm run start        # run the production build
npm run lint          # eslint
npm run typecheck      # tsc --noEmit
npm test                # vitest — domain logic, API routes, agent tools
```

## Project layout

```text
app/[locale]/book/    customer booking wizard (next-intl routed)
app/admin/             Korean-only admin dashboard (no locale routing)
app/api/                 booking API route handlers
app/api/cron/reminders/    24h reminder trigger (external scheduler calls this)
lib/booking/               pure domain logic (availability, pricing, validation)
lib/notifications/           multi-channel notification service (see below)
lib/db/                     SQLite client + migrations
lib/repositories/             DB access, one file per table/aggregate
lib/agent/                     Gemini agent tool layer (no LLM wired up yet)
data/services.ts                  treatment catalog (source of truth for pricing)
messages/{en,ko,zh,ja}.json          customer-facing translations
tests/                                 vitest suite
```

## Notification System Setup

Reservation confirm/cancel/reminder events fan out through `lib/notifications/service.ts`
to the email provider — reservation code never talks to a provider directly. The provider
is optional: with no environment variables set, the app runs normally and email delivery
logs `provider_not_configured` instead of pretending to send anything.

```text
Reservation confirmed/updated/cancelled
        │
        ▼
lib/booking/reservationNotifications.ts   (builds the payload from trusted server data)
        │
        ▼
lib/notifications/service.ts              (logs every attempt)
        │
        └── Email (all customers with an address) ──────────── Resend
```

Every attempt — sent, failed, or skipped — is logged to the `notifications` table
(`lib/repositories/notificationRepository.ts`) keyed by `(reservation, channel, event)`, which
is also what makes the 24h reminder job idempotent: re-running it never double-sends.

### Required environment variables (all server-only, see `.env.example`)

| Channel | Variables |
|---|---|
| Email — Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Email delivery safety gate | `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENT` |
| Reminder cron | `CRON_SECRET` |

None of these are required for local development — the email provider degrades to a logged
`provider_not_configured` skip.

### Registering each provider

- **Resend**: create an account at resend.com, verify a sending domain, create an API key.
- **Email delivery safety gate**: `EMAIL_DELIVERY_MODE` defaults to `sandbox` unless set to exactly
  `production` (any unset/misspelled value stays in sandbox — see `lib/notifications/recipientPolicy.ts`).
  In sandbox mode every outgoing customer email — automatic on booking confirmation, or an admin's
  manual "Send Confirmation" from `/admin/reservations/[id]` — is redirected to `EMAIL_TEST_RECIPIENT`
  instead of the real customer address, and is skipped entirely (never sent to the customer) if that
  variable isn't set. The admin's "Send Test Email" button always targets `EMAIL_TEST_RECIPIENT`
  regardless of delivery mode, and never marks the reservation's confirmation as sent.
- **Reminder cron**: generate any long random string for `CRON_SECRET`, then point an external
  scheduler at `POST /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`.
  Any scheduler works — a Vercel Cron entry, a plain server crontab running `curl`, a GitHub
  Actions scheduled workflow. Run it at least hourly; the job is idempotent so more frequent
  runs are harmless.

Confirmation/update/reminder emails embed the directions map at `public/sketchmap.png` as an
inline Resend attachment (`content_id` → `cid:` reference in the HTML, see
`lib/notifications/mapAttachment.ts`) — the same file the admin detail page previews at
`/sketchmap.png`. Cancellation emails omit it by default.

### Known limitations

- `RESERVATION_UPDATED` has no real trigger yet — the codebase has no reservation-edit/reschedule
  feature to hang it off of. The event type, templates, and provider wiring all already support
  it; it just isn't called anywhere today.
- `node:sqlite` (this project's DB) assumes a long-lived Node process; the reminder cron
  endpoint is intentionally deployment-agnostic to work around that, but the underlying DB
  choice is unrelated to this feature and outside its scope.

## Learn More

This project uses [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS + `next-intl`.
