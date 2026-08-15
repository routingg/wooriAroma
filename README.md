# Woori Aroma 예약 시스템

[한국어](./README.md) | [English](./README.en.md) | [中文](./README.zh.md)

제주 중문의 프라이빗 스파 **Woori Aroma**를 위한 다국어 예약/운영 플랫폼입니다. 전체 제품/아키텍처
스펙은 `proposal.md`를 참고하세요.

## 요구 사항

- Node.js **22.5.0 이상** (내장 `node:sqlite` 모듈 사용 — `package.json`의 `engines` 참고)

## 시작하기

```bash
npm install
npm run dev
```

고객용 예약 사이트는 [http://localhost:3000](http://localhost:3000)(`/en`, `/ko`, `/zh`, `/ja`), 한국어
전용 관리자 대시보드는 [http://localhost:3000/admin](http://localhost:3000/admin)에서 확인할 수 있습니다.

로컬 개발에는 환경 변수가 필요 없습니다 — `.data/woori-aroma.sqlite3`(gitignore됨)에 로컬 SQLite DB를
자동 생성하고, 이메일 발송 연동이 없으면 발송을 안전하게 건너뜁니다. 실제 이메일 프로바이더를 연동할
때만 `.env.example`을 `.env.local`로 복사하세요.

**⚠️ `/admin`에는 아직 인증이 없습니다.** 로컬 개발에는 안전하지만, 인증이 추가되기 전까지는 외부에
공개 배포하면 안 됩니다 — `proposal.md` §11 참고.

## 스크립트

```bash
npm run dev        # 개발 서버 실행
npm run build       # 프로덕션 빌드
npm run start        # 프로덕션 빌드 실행
npm run lint          # eslint
npm run typecheck      # tsc --noEmit
npm test                # vitest — 도메인 로직 / API 라우트 / 관리자 기능 / 에이전트 도구
```

## 프로젝트 구조

```text
app/[locale]/book/    고객용 예약 위저드 (next-intl 라우팅)
app/admin/             한국어 전용 관리자 대시보드 (로케일 라우팅 없음)
app/api/                 예약 API 라우트 핸들러
app/api/cron/reminders/    24시간 전 리마인더 트리거 (외부 스케줄러가 호출)
lib/booking/               순수 도메인 로직 (가용성, 가격, 검증)
lib/admin/                   관리자 전용 로직 (확정 메일 문구 생성, 상태/라벨, 삭제 대상 판별)
lib/notifications/           멀티채널 알림 서비스 (아래 참고)
lib/db/                     SQLite 클라이언트 + 마이그레이션
lib/repositories/             테이블/애그리게이트별 DB 접근 계층
lib/agent/                     Gemini 에이전트 도구 레이어 (아직 LLM 미연동)
data/services.ts                  시술 카탈로그 (가격 기준 소스)
messages/{en,ko,zh,ja}.json          고객용 번역 리소스
tests/                                 vitest 테스트 스위트
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

### 환경 변수 (서버 전용, `.env.example` 참고)

| 채널 | 변수 |
|---|---|
| 이메일 — Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| 이메일 발송 안전장치 | `EMAIL_DELIVERY_MODE`, `EMAIL_TEST_RECIPIENT` |
| 리마인더 크론 | `CRON_SECRET` |

로컬 개발에는 전부 필요하지 않습니다 — 이메일 프로바이더가 없으면 `provider_not_configured`로
기록만 되고 넘어갑니다.

### 프로바이더 등록

- **Resend**: resend.com에서 계정 생성 → 발신 도메인 인증 → API 키 발급.
- **이메일 발송 안전장치**: `EMAIL_DELIVERY_MODE`는 정확히 `production`이 아니면 항상 `sandbox`로
  동작합니다(미설정·오타 포함). sandbox 모드에서는 자동 발송(요청 접수/취소/리마인더)과
  `/admin/send-confirmation`의 수동 발송 모두 실제 고객 주소 대신 `EMAIL_TEST_RECIPIENT`로 전달되며,
  이 값이 없으면 아예 건너뜁니다. "테스트 메일 보내기" 버튼은 발송 모드와 무관하게 항상
  `EMAIL_TEST_RECIPIENT`로만 보냅니다.
- **리마인더 크론**: `CRON_SECRET`에 임의의 긴 문자열을 넣고, 외부 스케줄러(Vercel Cron, 서버
  crontab의 `curl`, GitHub Actions 등)가 `POST /api/cron/reminders`를
  `Authorization: Bearer <CRON_SECRET>` 헤더와 함께 호출하도록 설정하세요. 최소 1시간 간격 권장 —
  멱등성이 보장되므로 더 자주 실행해도 안전합니다.

자동 발송 이메일(요청 접수/취소/리마인더)은 `public/sketchmap.png` 약도를 인라인 첨부로 포함합니다
(`lib/notifications/mapAttachment.ts`). 취소 이메일은 기본적으로 지도를 포함하지 않습니다.

### 알려진 제한 사항

- `RESERVATION_UPDATED` 이벤트는 아직 실제로 트리거되는 곳이 없습니다 — 예약 수정/변경 기능 자체가
  아직 없기 때문입니다. 이벤트 타입·템플릿·프로바이더 연동은 이미 준비되어 있습니다.
- `node:sqlite`는 장기 실행 Node 프로세스를 전제로 합니다 — 리마인더 크론 엔드포인트는 이를 감안해
  배포 환경에 구애받지 않도록 설계했지만, DB 선택 자체는 이 기능과 무관한 별개의 결정입니다.

## 더 알아보기

이 프로젝트는 [Next.js](https://nextjs.org)(App Router) + TypeScript + Tailwind CSS + `next-intl`로
만들어졌습니다.
