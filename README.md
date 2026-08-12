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
to one provider per channel — reservation code never talks to a provider directly. Every
provider is optional: with no environment variables set, the app runs normally and every
channel logs `provider_not_configured` instead of pretending to send anything.

```text
Reservation confirmed/updated/cancelled
        │
        ▼
lib/booking/reservationNotifications.ts   (builds the payload from trusted server data)
        │
        ▼
lib/notifications/service.ts              (routes by lib/notifications/policy.ts, logs every attempt)
        │
        ├── Email (all customers with an address) ──────────── Resend
        ├── Korean customers (+82 phone)  ─── Kakao AlimTalk → SMS fallback on failure — SOLAPI
        ├── International customers (opted in) ─────────────── WhatsApp — Meta Cloud API
        └── Store administrator (every event) ─────────────── Telegram Bot API
```

Every attempt — sent, failed, or skipped — is logged to the `notifications` table
(`lib/repositories/notificationRepository.ts`) keyed by `(reservation, channel, event)`, which
is also what makes the 24h reminder job idempotent: re-running it never double-sends.

### Required environment variables (all server-only, see `.env.example`)

| Channel | Variables |
|---|---|
| Email — Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Korean — SOLAPI | `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`, `SOLAPI_KAKAO_PFID`, `SOLAPI_KAKAO_TEMPLATE_ID` |
| WhatsApp — Meta Cloud API | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_CONFIRMATION`, `WHATSAPP_TEMPLATE_REMINDER`, `WHATSAPP_TEMPLATE_UPDATE`, `WHATSAPP_TEMPLATE_CANCELLATION` |
| Admin — Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` |
| Reminder cron | `CRON_SECRET` |

None of these are required for local development — every provider degrades to a logged
`provider_not_configured` skip.

### Registering each provider

- **Resend**: create an account at resend.com, verify a sending domain, create an API key.
- **SOLAPI**: create an account at solapi.com, register a Kakao channel + AlimTalk sender
  profile (`pfId`), and get an AlimTalk template approved by Kakao — approval is required
  before `SOLAPI_KAKAO_TEMPLATE_ID` can be used; until then Korean customers automatically
  get SMS only (`lib/notifications/providers/korean.ts` skips Kakao cleanly). The template's
  approved variable names must match what `lib/notifications/templates/korean.ts`'s
  `buildKakaoVariables()` sends — confirm/update that mapping against the actual approved
  template before going live.
- **WhatsApp (Meta Cloud API)**: create a Meta Business app with the WhatsApp product, get a
  phone number ID, and get each of the 4 message templates (confirmation/update/cancellation/
  reminder) approved in Meta Business Manager. The approved body text's `{{1}}..{{6}}`
  placeholders must match the order defined in `lib/notifications/templates/whatsapp.ts`'s
  `buildWhatsAppBodyParameters()` (name, reservation number, date, time, treatment, guests).
- **Telegram**: create a bot via [@BotFather](https://t.me/BotFather) for `TELEGRAM_BOT_TOKEN`,
  then message the bot once and call `https://api.telegram.org/bot<token>/getUpdates` to read
  back the admin's `chat.id` for `TELEGRAM_ADMIN_CHAT_ID`.
- **Reminder cron**: generate any long random string for `CRON_SECRET`, then point an external
  scheduler at `POST /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`.
  Any scheduler works — a Vercel Cron entry, a plain server crontab running `curl`, a GitHub
  Actions scheduled workflow. Run it at least hourly; the job is idempotent so more frequent
  runs are harmless.

### Known limitations

- `RESERVATION_UPDATED` has no real trigger yet — the codebase has no reservation-edit/reschedule
  feature to hang it off of. The event type, templates, and provider wiring all already support
  it; it just isn't called anywhere today.
- Kakao/WhatsApp "sent" means the provider accepted the message for delivery, not that the
  customer's device confirmed receipt — true delivery status would need each provider's webhook,
  which isn't implemented.
- `node:sqlite` (this project's DB) assumes a long-lived Node process; the reminder cron
  endpoint is intentionally deployment-agnostic to work around that, but the underlying DB
  choice is unrelated to this feature and outside its scope.

## Learn More

This project uses [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS + `next-intl`.
