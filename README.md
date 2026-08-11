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
lib/booking/               pure domain logic (availability, pricing, validation)
lib/db/                     SQLite client + migrations
lib/repositories/             DB access, one file per table/aggregate
lib/agent/                     Gemini agent tool layer (no LLM wired up yet)
data/services.ts                  treatment catalog (source of truth for pricing)
messages/{en,ko,zh,ja}.json          customer-facing translations
tests/                                 vitest suite
```

## Learn More

This project uses [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS + `next-intl`.
