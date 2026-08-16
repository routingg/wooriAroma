# Woori Aroma 예약 시스템 — 개발 현황 정리

작성일: 2026-08-15 (현재 대화 시점 기준, `git log` 최신 커밋 `5acf052`)

> ⚠️ **이 문서는 2026-08-15 시점의 스냅샷이며, 이후 상태와 맞지 않습니다.** 다음날(2026-08-16)
> Gemini AI 예약 상담 기능 연동, 보안 검토, `/admin` HTTP Basic Auth 추가, Cloudflare 실배포
> (`https://wooriaroma.site` / www.wooriaroma.site)가 모두 완료되었습니다 — 특히 아래 §3·§6·§11에서
> "미구현"으로 표시된 관리자 인증 항목은 **더 이상 사실이 아닙니다.** 최신 현황은 `report.md`를,
> `README.md`/`proposal.md`도 이후 갱신되었으니 함께 참고하세요. 이 문서 자체는 그 시점의 커밋
> 히스토리·아키텍처 조사 기록으로서만 유효합니다.

> 이 문서는 코드베이스와 git 히스토리를 직접 확인해 작성한 **현재 상태 스냅샷**입니다.
> `README.md`/`proposal.md`는 일부 오래된 내용(DB 스택 등)을 담고 있어 아래에서 실제 코드와의
> 차이를 별도로 표시했습니다.

---

## 1. 프로젝트 개요

- **제품**: 제주 중문 프라이빗 스파 "우리같이아로마(Woori Aroma)"의 다국어 고객 예약 사이트 + 한국어 관리자 대시보드
- **스택**: Next.js 16.3.0 (App Router) + TypeScript + Tailwind CSS 4 + `next-intl` 4 + React 19.2.8
- **배포 타깃**: Cloudflare Workers (`@opennextjs/cloudflare` + `wrangler`)
- **DB**: Cloudflare D1 (SQLite 호환)
- **테스트**: Vitest — 현재 **17개 파일, 105개 테스트 전부 통과** (직접 실행 확인)

---

## 2. 최근 커밋 히스토리 (최신순)

| 커밋 | 내용 |
|---|---|
| `5acf052` | fix: lockfile 동기화, Cloudflare 빌드용 네이티브 바이너리 install script 허용 |
| `c283774` | fix: 기본 로케일 영어로 고정, 아로마 오일 트리트먼트 사진 교체 |
| `9ecb05e` | **chore: DB 레이어를 `node:sqlite` → Cloudflare D1로 마이그레이션** (대규모 변경) |
| `4a49e0d`, `65710e8` | fix: OpenNext 빌드에 필요한 esbuild 추가 |
| `adb150c` | fix: Cloudflare용 의존성 동기화 |
| `c2d6f97`, `5ff5303` | chore: OpenNext Cloudflare 설정/구성 추가 |
| `a1f5735` | fix: Cloudflare 빌드용 package-lock 재생성 |
| `34c2ece` | feat: 관리자 자동 발송 이메일 → 복사·붙여넣기 방식으로 전환, soft delete 추가 |
| `52c3e66` | feat: 홈페이지 리디자인, 예약 플로우를 "심사 대기(pending-review)" 방식으로 전환 |
| `86cbc43` | refactor: 시술 메뉴/관리자 예약 목록 개편, 이메일 전용 알림으로 단순화 |
| `515bbcd` | feat: 이메일/카카오/왓츠앱/텔레그램 멀티채널 알림 추가 *(이후 86cbc43에서 이메일 전용으로 축소됨)* |
| `1b9bfd6` | feat: 예약 사이트용 5종 테마 스킨 시스템 |
| `7f2851f` | feat: 영속 백엔드, 예약 API, 관리자 대시보드, 에이전트 도구 레이어 최초 구현 |
| `395cedd`, `91be2e6` 등 | 초기 랜딩 페이지/예약 UI 구축 |

**흐름 요약**: 초기 예약 UI(mock 결제 포함) → 실제 백엔드(SQLite) 연동 → 관리자 대시보드/알림 →
**결제 단계 제거, "예약 요청 → 관리자 승인" 방식으로 전환** → 알림을 이메일 전용으로 단순화,
발송도 자동이 아닌 관리자 수동 복사·붙여넣기 방식으로 변경 → **Cloudflare Workers/D1 배포 준비**
(가장 최근 5개 커밋 전부 이 작업).

---

## 3. 아키텍처 — 문서와 실제 코드의 차이

| 항목 | `proposal.md` / `README.md` 기술 내용 | **실제 코드 (확인됨)** |
|---|---|---|
| DB | `node:sqlite` (Node 내장 모듈), `.data/*.sqlite3` 파일 | **Cloudflare D1** (`wrangler.jsonc`의 `d1_databases` 바인딩, `lib/db/client.ts`가 `getCloudflareContext().env.DB` 반환) |
| 예약 확정 흐름 | "예약금 결제 → 즉시 확정" | **결제 없음.** 고객은 요청만 제출 → `PENDING` 상태 → 관리자가 검토 후 `CONFIRMED`로 변경 → 확정 메일은 관리자가 `/admin/reservations/[id]`에서 문구를 복사해 Gmail 등으로 **수동 발송** |
| 알림 채널 | "이메일/카카오/왓츠앱/텔레그램 멀티채널"(§6.3, 커밋 `515bbcd`) | **이메일(Resend)만 실제 구현** (`lib/notifications/providers/`에 `email.ts`만 존재) |
| 관리자 인증 | "배포 전 최우선 처리 필요"로 명시 | **여전히 미구현.** `middleware.ts`/`app/admin/layout.tsx`에 인증 로직 없음 — `/admin`은 여전히 공개 접근 가능 |
| README.md 스크립트 안내 | `npm run dev` 시 SQLite 자동 생성 언급 | 실제로는 `next.config.ts`의 `initOpenNextCloudflareForDev()`로 로컬 D1 바인딩 사용, `wrangler d1 migrations apply woori-aroma-db --local`로 스키마 시딩 필요 |

> **주의**: `README.md`/`README.en.md`/`README.zh.md`는 위 D1 마이그레이션(`9ecb05e`) 이전 상태를
> 기준으로 작성되어 있어 현재 코드와 어긋납니다. 갱신이 필요합니다.

---

## 4. 예약 도메인 로직 — 실제 구현 상태

### 상태 머신 (마이그레이션 `0005_pending_reservation_status.sql` 기준)
```
DRAFT → HOLD → PENDING → CONFIRMED → COMPLETED
                              ↘ CANCELLED
                              ↘ NO_SHOW
```
- `types/booking.ts`의 `BookingStatus` 타입은 `PENDING/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW`만
  노출하지만, DB 체크 제약조건에는 `DRAFT`, `HOLD`도 포함되어 있음 (예약 홀드 → 제출 전 임시 상태).

### 예약 규칙
- 동시간대 1팀 원칙 (`lib/booking/availability*.ts`)
- 시술 전/후 60분 준비·정리 버퍼 자동 차단
- 서버가 트랜잭션 내에서 가용성 재검증 (더블부킹 방지)
- 소프트 삭제(`deleted_at`) — `COMPLETED/CANCELLED/NO_SHOW` 상태에서만 관리자가 목록에서 삭제 가능,
  실제 레코드는 보존 (`migrations/0006_reservation_soft_delete.sql`)

### API 라우트 (`app/api/**/route.ts`)
- `GET /api/services`
- `GET /api/availability`
- `POST /api/reservation-holds` (임시 홀드, 기본 10분 — `BOOKING_HOLD_MINUTES`)
- `POST /api/reservations`
- `GET /api/reservations/:reservationNumber`
- `POST /api/cron/reminders` — 24시간 전 리마인더, `Authorization: Bearer <CRON_SECRET>` 필요

---

## 5. 알림 시스템 (`lib/notifications/`)

- 발송 지점은 `lib/notifications/service.ts` 단일 지점으로 통일, 모든 시도(성공/실패/스킵)를
  `notifications` 테이블에 `(예약, 채널, 이벤트)` 단위로 기록 → 리마인더 크론 재실행 시 중복 발송 방지(멱등성)
- **자동 발송**: 예약 요청 접수(`RESERVATION_REQUEST_RECEIVED`), 확정 예약 취소
  (`RESERVATION_CANCELLED`), 24시간 전 리마인더(`RESERVATION_REMINDER`)
- **수동 발송만 가능**: `RESERVATION_CONFIRMED` — 시스템이 대신 보내지 않고, 관리자가
  `/admin/reservations/[id]`의 "메일 작성" 패널에서 텍스트/HTML 버전을 준비해 직접 복사·발송
- **환경변수 안전장치**: `EMAIL_DELIVERY_MODE`가 정확히 `production`이 아니면(미설정 포함) 항상
  sandbox — 실제 고객 대신 `EMAIL_TEST_RECIPIENT`로만 전달
- **알려진 제한**: `RESERVATION_UPDATED` 이벤트는 타입/템플릿만 준비, 실제 트리거 지점 없음(예약
  수정 기능 자체가 아직 없음)

---

## 6. 관리자 대시보드 (`/admin`, 한국어 전용)

구현됨:
- 오늘 현황(팀 수/인원/매출/예약금 — `lib/admin/dashboardStats.ts`)
- 예약 목록 + 상태 변경 (`app/admin/reservations/`)
- 확정 메일 작성/복사 (`ManualConfirmationComposer`, `EmailComposer`)
- 이메일 발송 완료 수동 표시 (`EmailStatusControl`, 예약 상태와 별개로 관리)
- 시간 차단 관리 (`/admin/blocked-times`)
- 에이전트 핸드오프 큐 (`/admin/agent-handoffs`)
- 오프라인 예약용 수동 발송 화면 (`/admin/send-confirmation`)
- 소프트 삭제된 예약 복구 불가 UI (`DeleteReservationButton` + soft delete)

**미구현 (proposal.md §11에서도 명시)**:
- **관리자 인증 — 배포 전 최우선 처리 필요, 현재 여전히 없음**
- 관리자 수기 예약 등록
- 일/주/월 캘린더 그리드 뷰 (현재 목록 뷰만 존재)
- 유입 경로(source) 트래킹/애널리틱스

---

## 7. 에이전트(AI) 도구 레이어 (`lib/agent/tools.ts`)

- 실제 LLM(Gemini 등) 연동 없음 — 도구 함수 레이어만 준비된 상태
- `getReservation`은 신원 확인 필요, 처리 불가 케이스는 `handoffToAdmin`으로 `/admin/agent-handoffs`
  큐에 적재
- 테스트 커버리지 있음 (`tests/agent/tools.test.ts`)

---

## 8. 다국어 (`next-intl`)

- 지원 언어: `en`(기본, 최근 `c283774`에서 기본 로케일 영어로 재확정) / `ko` / `zh` / `ja`
- 로케일 라우팅은 `middleware.ts`가 담당하되, Next.js 16의 신규 `proxy.ts` 컨벤션 대신 구
  `middleware.ts`를 **의도적으로 유지** — `@opennextjs/cloudflare` 1.20.2가 Node.js 미들웨어를
  지원하지 않아 `proxy.ts`로 바꾸면 Cloudflare 빌드가 깨짐 (코드 주석에 근거·이슈 링크 명시)
- `/admin`, `/dev`는 로케일 라우팅에서 제외

---

## 9. 테마 시스템 (`lib/themes/`, `app/dev/themes`)

- 5종 스킨: `jeju-forest`(기본), `jeju-resort`, `korean-minimal`, `modern-wellness`, `dark-luxury`
- `/dev/themes`에서 미리보기 그리드 제공 (개발 전용 라우트)

---

## 10. 배포 준비 상태 (Cloudflare)

- `wrangler.jsonc`: D1 바인딩(`DB`), 정적 자산, self-reference 서비스 바인딩(ISR용) 설정 완료
- `open-next.config.ts`: 기본 Cloudflare 설정
- `package.json`에 `cf-typegen` / `cf:preview` / `cf:deploy` 스크립트 존재
- 최근 5개 커밋 전부 Cloudflare 빌드를 통과시키기 위한 수정(lockfile 동기화, esbuild 추가, 네이티브
  바이너리 install script 허용 등) — **현재 이 배포 파이프라인이 막 안정화된 시점**으로 보임
- 실제 `wrangler d1 create` 이후의 `database_id`가 `wrangler.jsonc`에 이미 채워져 있어, Cloudflare
  프로젝트/D1 DB 자체는 이미 생성된 상태로 추정됨 (직접 `wrangler` 계정 확인은 하지 않음)

---

## 11. 남은 작업 (proposal.md §11 + 코드 확인 기준)

우선순위 순:

1. **관리자 인증** — `/admin`이 여전히 완전 공개 상태. 실서비스 배포 전 최우선.
2. README.md / README.en.md / README.zh.md 갱신 — DB 스택(D1) 및 예약금 결제 제거/승인제 전환
   반영 안 됨.
3. 결제 게이트웨이 여부 재결정 — 현재는 결제 자체를 없애고 현장 결제로 전환한 상태이므로, 이 결정을
   `proposal.md` 본문에도 명시적으로 반영할지 검토.
4. 관리자 수기 예약 등록 / 캘린더 그리드 뷰
5. 유입 경로 트래킹, 애널리틱스
6. Gemini 등 실제 LLM 연동 (도구 레이어는 준비됨)
7. Cloudflare 프로덕션 배포 검증 (`cf:preview` → `cf:deploy` 실행 및 실제 D1 마이그레이션 적용 확인)

---

## 12. 빠른 참조

```bash
npm run dev          # 로컬 개발 서버 (로컬 D1 바인딩 자동)
npm test              # vitest — 17 files / 105 tests, 전부 통과 확인됨
npm run lint            # eslint
npm run typecheck        # tsc --noEmit
npm run cf:preview        # OpenNext 빌드 + Cloudflare 로컬 프리뷰
npm run cf:deploy          # OpenNext 빌드 + Cloudflare 배포
wrangler d1 migrations apply woori-aroma-db --local   # 로컬 D1 스키마 시딩
```
