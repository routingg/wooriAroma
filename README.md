# Woori Aroma 예약 시스템

[한국어](./README.md) | [English](./README.en.md) | [中文](./README.zh.md)

실제 운영 준비는 [관리자 알림·개인정보·DB 운영 안내](./docs/operations-readiness.md)를 먼저 확인하세요.
관리자 새 예약 이메일과 실패 재시도 기능은 `/admin/notifications`에서 확인할 수 있습니다. 업데이트 시 새 DB 마이그레이션을 적용하고 `.env.example`의 관리자 알림 설정 및 외부 재시도 스케줄러를 연결해야 합니다.
개인정보 보유기간에 따른 자동 파기와 고객용 개인정보 고지는 아직 구현되지 않았습니다.
AI 예약 상담은 실제 서비스 출시 전 Gemini API의 결제·데이터 처리 조건을 반드시 확인하세요 — 자세한 내용은 위 운영 안내 문서의 "AI와 관리자 접근" 항목 참고.

제주 중문의 프라이빗 스파 **Woori Aroma**를 위한 다국어 예약/운영 플랫폼입니다. 전체 제품/아키텍처
스펙은 `proposal.md`를, 개발 진행 경과는 `report.md`를 참고하세요.

**실제 서비스: [https://wooriaroma.site](https://wooriaroma.site) (www.wooriaroma.site)** — Cloudflare
Workers에 배포되어 있습니다 (`wrangler.jsonc`).

## 요구 사항

- Node.js **22.5.0 이상** (`package.json`의 `engines` 참고)

## 시작하기

```bash
npm install
wrangler d1 migrations apply woori-aroma-db --local   # 로컬 D1 스키마 최초 1회 시딩
npm run dev
```

고객용 예약 사이트는 [http://localhost:3000](http://localhost:3000)(`/en`, `/ko`, `/zh`, `/ja`), 한국어
전용 관리자 대시보드는 [http://localhost:3000/admin](http://localhost:3000/admin)에서 확인할 수 있습니다.
매장에서 태블릿으로 신규 고객에게 보여주는 웰컴 키오스크는
[http://localhost:3000/welcome](http://localhost:3000/welcome)입니다(로그인 불필요, 로케일 라우팅 없음).

DB는 별도 환경 변수 없이 `next.config.ts`의 `initOpenNextCloudflareForDev()`가 로컬 Cloudflare D1
바인딩을 자동으로 연결합니다(위 마이그레이션 명령은 최초 1회만 필요). 이메일 발송 연동이 없으면
발송을 안전하게 건너뜁니다. 실제 이메일 프로바이더를 연동할 때만 `.env.example`을 `.env.local`로
복사하세요.

**⚠️ `/admin`은 HTTP Basic Auth로 보호됩니다.** `ADMIN_BASIC_AUTH_USER`/`ADMIN_BASIC_AUTH_PASSWORD`
환경 변수가 설정되지 않으면 모든 요청을 거부하는 Fail-Closed 방식이라, 로컬 개발에서도 `/admin`을
쓰려면 `.env.local`에 이 값을 설정해야 합니다 — `.env.example` 참고.

## 스크립트

```bash
npm run dev        # 개발 서버 실행
npm run build       # 프로덕션 빌드
npm run start        # 프로덕션 빌드 실행
npm run lint          # eslint
npm run typecheck      # tsc --noEmit
npm test                # vitest — 도메인 로직 / API 라우트 / 관리자 기능 / 에이전트 도구
npm run cf:preview        # OpenNext 빌드 + Cloudflare 로컬 프리뷰
npm run cf:deploy          # OpenNext 빌드 + Cloudflare 배포
```

## 프로젝트 구조

```text
app/[locale]/book/         고객용 예약 위저드 (next-intl 라우팅)
app/[locale]/              홈페이지 — Gemini AI 예약 상담 CTA/채팅 다이얼로그 포함
app/welcome/                매장용 태블릿 웰컴 키오스크 (로그인·로케일 라우팅 없음)
app/admin/                  한국어 전용 관리자 대시보드 (사이드바 내비게이션 공통 레이아웃)
app/admin/blocked-times/      차단 시간 + 예약 전후 준비/정리 버퍼 설정
app/admin/notifications/       관리자 알림(신규 예약) 발송/재시도 상태 확인
app/admin/agent-handoffs/       AI 상담에서 사람 응대로 넘어간 건 확인
app/admin/send-confirmation/     오프라인/수동 예약 확정 메일 즉시 발송
app/api/                    예약 API 라우트 핸들러
app/api/agent/chat/           Gemini function-calling 예약 상담 엔드포인트
app/api/cron/reminders/        24시간 전 리마인더 트리거 (외부 스케줄러가 호출)
app/api/cron/notifications/     관리자 알림 발송 실패 재시도 트리거 (외부 스케줄러가 호출)
lib/booking/                 순수 도메인 로직 (가용성, 가격, 버퍼, 검증)
lib/admin/                    관리자 전용 로직 (확정 메일 문구 생성, 상태/라벨, 삭제 대상 판별)
lib/notifications/             멀티채널 알림 서비스 (아래 참고)
lib/solapi.ts                    Solapi 기반 관리자 신규 예약 SMS 알림
lib/db/                        Cloudflare D1 클라이언트 + 마이그레이션
lib/repositories/                테이블/애그리게이트별 DB 접근 계층
lib/agent/                        Gemini 에이전트 도구 레이어 (Function Calling 연동 완료)
data/services.ts                     시술 카탈로그 (가격 기준 소스)
messages/{en,ko,zh,ja}.json             고객용 번역 리소스
tests/                                    vitest 테스트 스위트
docs/operations-readiness.md                실제 운영 전환 시 확인할 알림/개인정보/DB 절차
```

## 예약 및 이메일 워크플로우

예약이 접수된다고 바로 확정되는 것은 아닙니다. 예치금(디파짓)도 없습니다 — 고객은 예약 요청만
제출하고, 결제는 매장 방문 시 이루어집니다.

```text
고객이 예약 요청 제출 (결제 없음)
        │
        ▼
예약 상태: 예약 대기 (PENDING)  ← 이 시점에 "예약 요청이 접수되었습니다"
                                   이메일이 자동으로 발송됨
        │
        ▼
관리자가 일정을 확인하고 상태를 예약 확정으로 변경
        │
        ▼
관리자가 /admin/reservations 에서 확정 메일 문구를 검토·수정하고
텍스트 버전 또는 디자인(HTML) 버전을 복사
        │
        ▼
관리자가 Gmail 등에서 직접 발송
        │
        ▼
관리자가 "메일 발송 완료"로 수동 표시 (예약 상태와는 별개로 관리)
```

예약이 **예약 완료 / 예약 취소 / 노쇼** 상태가 되면 관리자는 목록에서 해당 항목을 삭제할 수 있습니다.
실제 DB 레코드는 삭제되지 않고 소프트 삭제(`deleted_at`)되어 이력은 그대로 보존되며, 일반 목록·검색·
통계에서만 제외됩니다.

## 알림 시스템

`lib/notifications/service.ts`가 이메일 발송을 담당하는 유일한 지점입니다 — 예약 도메인 코드는
프로바이더(Resend)를 직접 호출하지 않습니다. 모든 발송 시도는 성공/실패/건너뜀 여부와 관계없이
`notifications` 테이블(`lib/repositories/notificationRepository.ts`)에 `(예약, 채널, 이벤트)` 단위로
기록되며, 이 기록이 24시간 리마인더 재실행 시 중복 발송을 막는 멱등성 기준이 됩니다.

### 자동으로 발송되는 이메일

| 시점 | 이벤트 |
|---|---|
| 고객이 예약을 제출할 때 | 예약 요청 접수 안내 (`RESERVATION_REQUEST_RECEIVED`) |
| 관리자가 확정된 예약을 취소할 때 | 예약 취소 안내 (`RESERVATION_CANCELLED`) |
| 방문 24시간 전 (크론) | 리마인더 (`RESERVATION_REMINDER`) |

### 수동으로만 발송되는 이메일

- **예약 확정 안내(`RESERVATION_CONFIRMED`)는 온라인 예약 건에 대해 자동 발송되지 않습니다.**
  `/admin/reservations/[id]`의 "메일 작성" 패널에서 텍스트 버전/디자인 버전 문구를 준비·수정하고,
  관리자가 직접 복사해 Gmail 등에서 발송해야 합니다. 시스템이 이 이메일을 대신 보내는 일은 없습니다.
- 온라인 예약과 연결되지 않은 수동/오프라인(전화 등) 건은 `/admin/send-confirmation`에서 별도로 즉시
  발송할 수 있습니다 — 이 화면은 여전히 Resend를 통해 실제로 발송합니다.

### 관리자 신규 예약 알림 (이메일 + SMS)

새 예약이 `PENDING`으로 전환되면(일반 예약 폼과 AI 예약 모두 해당) 고객 안내 메일과는 별개로
관리자에게 두 채널로 알림이 갑니다.

- **이메일**: `admin_booking_alerts` 테이블에 대기 기록을 만들고 Resend로 발송을 시도합니다. 즉시 발송이
  실패하면 `POST /api/cron/notifications`가 최대 6회, 첫 시도 후 23시간 이내까지 재시도하며, 진행
  상태는 `/admin/notifications`에서 확인할 수 있습니다. 메일 본문에는 고객 이름·연락처·요청사항이
  포함되지 않습니다.
- **SMS**: `lib/solapi.ts`가 Solapi를 통해 `ADMIN_NOTIFICATION_PHONE`으로 문자를 한 번 보냅니다
  (`SOLAPI_*` 변수 참고). 재시도 큐는 없으며, 발송 실패가 예약 저장 자체를 실패시키지 않습니다.

### 환경 변수 (서버 전용, `.env.example` 참고)

| 채널 | 변수 |
|---|---|
| 이메일 — Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| 이메일 발송 안전장치 | `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENT` |
| 관리자 신규 예약 이메일 알림 | `ADMIN_NOTIFICATION_EMAIL`, `ADMIN_NOTIFICATION_ORIGIN` |
| 관리자 신규 예약 SMS 알림 — Solapi | `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_PHONE`, `ADMIN_NOTIFICATION_PHONE` |
| 리마인더 크론 | `CRON_SECRET` (`/api/cron/reminders`와 `/api/cron/notifications`가 공유) |
| Gemini AI 예약 상담 | `GEMINI_API_KEY`, `GEMINI_MODEL`(선택) |

로컬 개발에는 전부 필요하지 않습니다 — 프로바이더가 없으면 각각 `provider_not_configured` 로그를
남기거나 안전한 폴백 응답으로 건너뛰고, 예약 자체는 계속 정상 동작합니다.

### 프로바이더 등록

- **Resend**: resend.com에서 계정 생성 → 발신 도메인 인증 → API 키 발급.
- **이메일 발송 안전장치**: `EMAIL_DELIVERY_MODE`는 정확히 `production`이 아니면 항상 `sandbox`로
  동작합니다(미설정·오타 포함). sandbox 모드에서는 자동 발송(요청 접수/취소/리마인더)과
  `/admin/send-confirmation`의 수동 발송 모두 실제 고객 주소 대신 `EMAIL_TEST_RECIPIENT`로 전달되며,
  이 값이 없으면 아예 건너뜁니다. "테스트 메일 보내기" 버튼은 발송 모드와 무관하게 항상
  `EMAIL_TEST_RECIPIENT`로만 보냅니다.
- **관리자 알림 재시도 크론**: `CRON_SECRET`을 설정하고 외부 스케줄러가 5분마다
  `POST /api/cron/notifications`를 `Authorization: Bearer <CRON_SECRET>` 헤더와 함께 호출하도록
  연결하세요. 자세한 절차는 [운영 안내 문서](./docs/operations-readiness.md)의 "관리자 예약 알림 설정"
  참고.
- **Solapi**: solapi.com에서 계정 생성 → 발신번호 등록 → API 키/시크릿 발급.
- **리마인더 크론**: `CRON_SECRET`에 임의의 긴 문자열을 넣고, 외부 스케줄러(Vercel Cron, 서버
  crontab의 `curl`, GitHub Actions 등)가 `POST /api/cron/reminders`를
  `Authorization: Bearer <CRON_SECRET>` 헤더와 함께 호출하도록 설정하세요. 최소 1시간 간격 권장 —
  멱등성이 보장되므로 더 자주 실행해도 안전합니다.

자동 발송 이메일(요청 접수/취소/리마인더)은 `public/sketchmap.png` 약도를 인라인 첨부로 포함합니다
(`lib/notifications/mapAttachment.ts`). 취소 이메일은 기본적으로 지도를 포함하지 않습니다.

### 알려진 제한 사항

- `RESERVATION_UPDATED` 이벤트는 아직 실제로 트리거되는 곳이 없습니다 — 예약 수정/변경 기능 자체가
  아직 없기 때문입니다. 이벤트 타입·템플릿·프로바이더 연동은 이미 준비되어 있습니다.

## AI 예약 상담 (Gemini)

홈페이지의 채팅 CTA(`/api/agent/chat`)를 통해 고객이 자연어로 시술/가격 안내, 가용 시간 조회, 예약
생성, 예약번호+이메일(또는 전화번호) 일치 확인을 통한 상태 조회까지 진행할 수 있습니다 —
`lib/agent/`의 Function Calling 도구(`lib/agent/toolDeclarations.ts`)가 `lib/booking/`과 동일한
가용성·검증 로직을 그대로 호출하므로 일반 예약 폼과 예약 규칙이 다르지 않습니다. 5인 이상, 예약
변경/취소, 특수 요청 등 AI가 처리할 수 없는 경우는 `handoffToAdmin` 도구로 사람 상담으로 넘어가며, 이
대화는 `agent_handoffs` 테이블에 기록되어 `/admin/agent-handoffs`에서 확인할 수 있습니다.
`GEMINI_API_KEY`가 없으면 채팅은 "AI assistant is temporarily unavailable" 안내로 안전하게 폴백되며,
고객 예약 위저드는 영향을 받지 않습니다.

**실제 서비스 출시 전 확인 필요**: Gemini API의 Unpaid/Paid 상태에 따라 개인정보 처리 조건이 다릅니다.
자세한 내용과 권장 절차는 [운영 안내 문서](./docs/operations-readiness.md)의 "AI와 관리자 접근" 항목을
참고하세요.

## 관리자 대시보드

`/admin`은 공통 사이드바 내비게이션(`components/admin/AdminSidebar.tsx`)을 가진 레이아웃으로
예약 목록, 차단 시간, 알림 상태, AI 상담 인계, 수동 확정 메일 화면을 오갈 수 있습니다.
`/admin/blocked-times`에서는 특정 날짜/시간을 차단하는 것 외에도 모든 예약 앞뒤로 적용할 준비·정리
버퍼(분 단위)를 설정할 수 있어, 가용 시간 계산(`lib/booking/availability.ts`)이 이 값을 반영합니다.

## 더 알아보기

이 프로젝트는 [Next.js](https://nextjs.org)(App Router) + TypeScript + Tailwind CSS + `next-intl`로
만들어졌으며, Cloudflare Workers(`@opennextjs/cloudflare` + Wrangler)와 Cloudflare D1에 배포되어
있습니다. 개발 경과와 배포 세부 사항은 `report.md`를 참고하세요.
