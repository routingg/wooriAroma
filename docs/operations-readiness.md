# 실제 예약 운영 준비

확인일: 2026-09-08. 저장소 코드와 아래 공식 문서를 기준으로 작성했다. 운영 Cloudflare 계정, 실제 DB 내용, 비밀키, 메일 수신함은 확인하지 않았다. 이 문서의 원격 명령은 실행되지 않았다.

D1을 유지하면서 운영에 필요한 절차를 보완할 수 있다. 이미 외래키, 예약 상태 제약, 조회 인덱스, 슬롯 중복을 막는 조건부 SQL, 순차 마이그레이션이 있다. 우선순위는 관리자 알림의 실제 수신 확인, 고객 정보 접근 제한, 보유·파기 정책, 환경 분리와 복원 훈련이다.

## 저장 구조와 남은 과제

| 대상 | 저장소 근거 | 운영상 의미 |
| --- | --- | --- |
| DB 연결 | `lib/db/client.ts`, `next.config.ts`, `wrangler.jsonc` | 서버가 요청별로 `DB` D1 바인딩을 사용한다. 개발 서버는 로컬 바인딩을 사용한다. |
| 예약 무결성 | `lib/repositories/reservationRepository.ts` | 슬롯 점유 여부를 `INSERT/UPDATE ... WHERE NOT EXISTS` 안에서 검사한다. 가용 시간 조회 결과만 믿고 예약을 쓰는 방식이 아니다. |
| 예약별 연락처 | `migrations/0007_customer_contact_isolation.sql`, `lib/repositories/customerRepository.ts` | 새 예약마다 별도 고객 레코드를 생성한다. 같은 이메일을 입력해도 과거 예약의 이름·전화번호를 덮어쓰지 않는다. 기존 고객 ID와 예약 연결은 보존하며, 이미 공유된 과거 연락처를 자동으로 분리하거나 복원하지 않는다. |
| 고객·예약 동시 저장 | `createHold()` | 고객 생성, 조건부 예약 저장, 슬롯 경쟁에서 실패한 새 고객 정리를 하나의 D1 batch로 처리한다. 예약번호 카운터 증가는 별도다. |
| 예약번호 | `lib/booking/reservationNumber.ts` | 번호 발급은 단일 SQL로 처리한다. 예약 저장 실패 시 번호가 건너뛸 수 있으므로 연속성을 회계 증빙으로 사용하지 않는다. |
| 조회와 관계 | `migrations/0001_init.sql`, `0003_agent_handoffs.sql`, `0006_reservation_soft_delete.sql` | 날짜·상태, 고객, 차단 시간, 예외함 상태, 숨김 표시 인덱스가 있다. 신규 화면은 실제 조회 계획을 확인한 뒤 인덱스를 추가한다. |
| 스키마 변경 | `migrations/0004_notifications_v2.sql`, `0005_pending_reservation_status.sql`, `0007_customer_contact_isolation.sql` | 제약 변경을 위해 테이블 생성→데이터 복사→교체를 수행한다. 빈 DB에서 성공하는 것만으로 기존 데이터 보존을 확인할 수 없다. |
| 관리자 삭제 | `migrations/0006_reservation_soft_delete.sql`, `softDeleteReservation()` | `deleted_at`을 기록해서 목록에서 숨긴다. 이름·연락처·요청사항을 실제로 파기하는 기능은 아니다. |
| 운영 환경 | `wrangler.jsonc` | 기본 설정에 운영 도메인 `wooriaroma.site`와 `woori-aroma-db`가 있다. 별도 staging 환경은 아직 정의되어 있지 않다. |

## 관리자 예약 알림 설정

새 예약이 `HOLD`에서 `PENDING`으로 바뀌면 `0008_admin_booking_alerts.sql`의 DB 트리거가 같은 쓰기 안에서 알림 대기 기록을 만든다. 일반 예약 폼과 AI 예약 모두 해당한다. 기존 예약을 소급해서 알리지는 않는다. 고객 안내 메일의 실패와 독립적으로 관리자 알림을 시도한다.

1. `.env.example`에 안내된 `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `ADMIN_NOTIFICATION_ORIGIN`을 서버 환경에 설정한다. 운영 origin은 `https://wooriaroma.site`처럼 경로 없는 HTTPS 주소다. 실제 키를 코드나 Git에 넣지 않는다.
2. 먼저 `EMAIL_DELIVERY_MODE=sandbox`, `EMAIL_TEST_RECIPIENT`를 설정하고 가짜 예약을 접수한다. 메일에는 새 예약 안내와 인증이 필요한 관리자 링크만 포함되며 고객 이름·연락처·요청사항은 포함하지 않는다.
3. `/admin/notifications`에서 테스트 발송 상태를 확인하고 실제 테스트 수신함도 확인한다. `TESTED`는 운영 발송 성공으로 계산하지 않는다. 운영 모드로 전환하면 테스트 완료 건도 운영 수신함으로 한 번 처리되므로, 테스트 예약은 별도 검증 환경에서 만든다.
4. 실제 수신을 검증한 뒤 운영 환경에서 `EMAIL_DELIVERY_MODE=production`을 설정한다. 이 변수는 **기존 고객용 자동·수동 메일에도 함께 적용**된다.
5. `CRON_SECRET`을 설정하고 외부 스케줄러가 5분마다 `POST /api/cron/notifications`를 `Authorization: Bearer <CRON_SECRET>` 헤더와 함께 호출하게 한다. 최초 발송은 예약 직후 시도하지만, 장애 후 주기적 재시도에는 스케줄러 연결이 필요하다. 비밀키를 URL에 넣지 않는다. 기존 `/api/cron/reminders`는 별도의 방문 전 리마인더 작업이다.

한 번의 cron 호출은 최대 5건을 처리한다. 일시적 실패는 재시도하고, 동일 작업의 동시 처리는 DB 임대로 제한한다. 발송 요청과 멱등 키를 보존하여 동일한 요청으로 재시도한다. 최대 6회, 첫 시도 후 23시간 이내에서만 자동 시도하며 영구 오류·설정 변경·한도 초과는 `DEAD`로 남아 관리자 확인을 요구한다. Resend의 멱등 키 유효기간은 24시간이므로, 이 시간이 지난 불명확한 발송을 자동 재전송하지 않는다. [Resend 멱등 키](https://resend.com/docs/dashboard/emails/idempotency-keys)

`SENT`는 이메일 서비스가 요청을 접수했다는 의미다. 수신함 도착·반송을 추적하는 webhook은 아직 없으므로 실제 수신과 스팸함을 확인한다. `/admin/notifications`에 표시된 확인 필요 건은 제공업체 발송 이력과 예약을 대조해 처리한다. 이 화면에는 강제 재발송 버튼이 없다. cron 자체가 멈춘 경우를 감지할 외부 모니터링과 영업 중 미확인 예약 점검 담당자도 필요하다.

## 개발·검증·운영 환경

| 환경 | DB | 데이터와 발송 정책 |
| --- | --- | --- |
| local | 로컬 D1 저장소 (`--local`) | 가짜 고객만 사용. `EMAIL_DELIVERY_MODE=sandbox`. |
| staging — 구성 필요 | 운영과 다른 D1 UUID 및 별도 Worker | 가짜 고객만 사용. 테스트 수신함으로만 전송. 운영 도메인 연결 금지. |
| production | 현재 `woori-aroma-db` | 실제 예약. 운영용 키·관리자 계정·발신 도메인을 별도로 관리. |

staging을 만들 때 `env.staging`에 별도 `d1_databases`, 테스트용 변수와 비밀키, 별도 route, staging Worker를 가리키는 `WORKER_SELF_REFERENCE`를 명시한다. 바인딩과 비밀키는 환경 사이에 자동 상속되지 않는다. `NODE_ENV=production`은 최적화된 빌드 여부이며 DB 환경을 분리하는 설정이 아니다. [Cloudflare 환경 설정](https://developers.cloudflare.com/workers/wrangler/environments/), [D1 환경 설정](https://developers.cloudflare.com/d1/configuration/environments/)

현재 설정에 `--env production` 또는 `--env staging`을 덧붙인다고 이 환경이 완성되지는 않는다. 먼저 DB UUID, Worker 이름, 도메인과 메일 대상이 분리되었는지 확인한다. OpenNext 빌드·미리보기·배포도 같은 환경을 선택하도록 함께 검증한다.

로컬 초기화와 새 마이그레이션 확인:

```powershell
npx wrangler d1 migrations list woori-aroma-db --local
npx wrangler d1 migrations apply woori-aroma-db --local
npm test
npm run typecheck
npm run lint
```

자동 테스트는 `tests/dbTestUtils.ts`의 메모리 SQLite 기반 D1 대역을 사용한다. Cloudflare 런타임 검증을 대신하지 않는다. staging에서는 일반 예약·AI 예약(활성화하는 경우)·예약 확정·취소·알림 실패 후 재시도·관리자 인증을 가짜 고객으로 확인한다.

## 데이터를 보존하는 배포 순서

1. 이미 적용한 SQL 파일을 수정하거나 `0001_init.sql`을 다시 실행하지 않는다. 변경마다 다음 번호의 새 파일을 추가한다. 적용 이력은 `d1_migrations`에 기록된다. [D1 마이그레이션](https://developers.cloudflare.com/d1/reference/migrations/)
2. 기존 스키마에 가짜 예약·고객·알림·예외함 데이터를 넣고 새 마이그레이션을 적용한다. PK/FK, 예약번호, 고객 연결, 예약 상태, 발송 이력, 숨긴 예약이 유지되는지 검사한다. 테이블을 교체할 때는 인덱스와 트리거도 확인한다.
3. staging에서 예약 흐름과 복원 훈련을 완료한다. 테이블 재작성처럼 구버전 앱과 충돌할 수 있는 변경은 예약 쓰기와 cron을 중지하는 점검 시간을 확보한다. 중단 없는 배포는 구버전·신버전 모두 호환되는 스키마 변경으로 나눈다.
4. 운영 대상 이름·UUID·계정과 미적용 마이그레이션 목록을 확인한다. 변경 직전 DB 상태와 Time Travel bookmark를 기록하고, 필요 시 아래와 같이 별도의 보호된 위치로 export한다.
5. 검토한 마이그레이션을 운영 DB에 적용한 후 해당 코드 버전을 배포한다. 테이블 건수, 외래키, 예약 조회, 실제 관리자 메일 수신을 확인한다. 코드만 되돌려도 DB 스키마가 되돌아가지는 않는다.

아래 원격 조회 명령은 현재 운영 DB를 대상으로 한다. 결과에는 운영 메타데이터가 포함되므로 접근 권한이 있는 운영자가 실행한다.

```powershell
npx wrangler d1 info woori-aroma-db
npx wrangler d1 migrations list woori-aroma-db --remote
npx wrangler d1 time-travel info woori-aroma-db
npx wrangler d1 execute woori-aroma-db --remote --command "PRAGMA foreign_key_check;"
npx wrangler d1 execute woori-aroma-db --remote --command "SELECT 'customers' AS entity, COUNT(*) AS count FROM customers UNION ALL SELECT 'reservations', COUNT(*) FROM reservations UNION ALL SELECT 'notifications', COUNT(*) FROM notifications UNION ALL SELECT 'agent_handoffs', COUNT(*) FROM agent_handoffs;"
```

`foreign_key_check`는 위반 행이 없어야 한다. 건수 비교는 예약 쓰기를 중지한 상태에서 수행하거나, 점검 중 새 예약을 고려해서 비교한다. 건수만 같다고 데이터 보존이 입증되지는 않으므로 staging에서 주요 필드도 비교한다.

아래 export의 경로는 예시다. Git 작업 폴더 밖에 접근 권한과 디스크 암호화가 설정된 저장 위치를 먼저 준비하고 실제 절대 경로로 바꾼다. `.sql` export는 개인정보를 담는 평문 파일이므로 공개 저장소·공유 링크·일반 개발 자료로 취급하지 않는다.

```powershell
npx wrangler d1 export woori-aroma-db --remote --output "C:\SECURE_BACKUP_DIRECTORY\woori-aroma-before-change.sql"
```

마이그레이션이 실패하면 실패한 파일의 변경은 롤백되지만, 그 전에 성공한 파일은 적용된 상태로 남는다. 여러 파일의 적용 전체가 한꺼번에 취소되는 것으로 가정하지 않는다. [Wrangler D1 명령](https://developers.cloudflare.com/d1/wrangler-commands/), [D1 내보내기](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

## 백업과 복원

D1 Time Travel은 자동 활성화된다. 복원 가능 기간은 Workers Free에서 7일, Paid에서 30일이다. 실제 계정 요금제는 별도로 확인해야 한다. 북마크를 저장해도 이 기간이 연장되지 않으며, 로컬 DB 복구 기능도 아니다. [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [D1 제한](https://developers.cloudflare.com/d1/platform/limits/)

Time Travel 복원은 원래 DB 전체를 과거 상태로 덮어쓰며 실행 중 쿼리를 취소한다. 특정 예약 하나만 되돌리는 기능이 아니다. 장애 시 다음 절차를 사용한다.

1. 예약 쓰기, 관리자 변경과 알림 cron을 중지하고 현재 시점의 bookmark를 기록한다. 장애 발생 시각을 UTC와 함께 기록한다.
2. 마지막 정상 시점과 복원으로 사라질 예약·변경을 확인한다. 예전 상태로 전체를 되돌릴지, 새 마이그레이션으로 문제를 고칠지 결정한다.
3. 복원 담당자가 실제 정상 bookmark로 바꾼 다음 아래 명령을 실행한다. 이 명령은 운영 DB를 덮어쓴다.

```powershell
npx wrangler d1 time-travel restore woori-aroma-db --bookmark "REPLACE_WITH_VERIFIED_BOOKMARK"
```

4. 외래키·예약 건수·상태와 코드/스키마 호환성을 확인한다. 복원 시점 이후 접수한 예약과 개인정보 삭제 요청을 재반영한다.
5. DB의 발송 상태는 과거로 돌아가도 이미 발송된 메일은 취소되지 않는다. 알림 cron 재개 전에 메일 제공업체 발송 이력과 대기 작업을 대조해 재발송을 방지한다.
6. 복원에서 반환하는 이전 bookmark도 보관한다. 해당 시점이 복원 가능 기간 안에 있을 때 복원 자체를 되돌리는 데 사용할 수 있다. [Time Travel 복원 절차](https://developers.cloudflare.com/d1/reference/time-travel/)

Time Travel로 별도 DB를 복제할 수 있다고 가정하지 않는다. 별도 DB 복원 훈련은 가짜 데이터로 만든 SQL export를 비어 있는 테스트 DB에 `d1 execute --file`로 import해서 진행한다. 장기 백업이 필요하면 보존 주기·보관 기한·접근 담당자·삭제 방식과 복원 목표 시간을 운영자가 정한다. 백업도 고객 정보 보유·파기 범위에 포함한다.

## 개인정보 운영 결정

예약번호만으로 조회하던 공개 GET API는 생성 시 발급된 무작위 `holdId`를 Bearer 헤더로 함께 요구하도록 변경했다. 응답은 `private, no-store`로 제공한다. 이 값은 조회 권한을 가진 비밀값이므로 URL·로그·공개 화면에 노출하지 않는다. 별도 만료·회전 가능한 고객 로그인 토큰이나 이메일 OTP는 아직 구현하지 않았다. AI의 예약 상태 조회는 여전히 입력한 이메일 또는 전화번호의 일치 확인을 사용하므로 같은 강도의 인증은 아니며, 운영용 본인확인과 요청 제한을 추가해야 한다.

브라우저의 기존 `localStorage` 예약 초안은 다음 예약 페이지 로딩 때 연락처·이름·요청사항·예약번호를 제거한다. 계속 저장하는 항목은 인원·시술·날짜·시간 등 선택값이다. 연락처 초안은 현재 탭의 `sessionStorage`에 만료시각과 함께 저장하며 30분이 지난 초안은 다음 로딩 때 복원하지 않고 지운다. 탭 종료와 예약 초기화 때도 세션 초안이 사라진다. 이는 서버 DB의 보유·파기 정책을 대체하지 않는다.

D1은 저장 시 암호화와 TLS 전송을 제공한다. 현재 앱은 이름·이메일·전화번호를 SQL로 읽을 수 있는 값으로 저장하므로, DB 저장 암호화만으로 관리자 계정 오용이나 잘못된 공개 API 응답을 막을 수는 없다. [D1 데이터 보안](https://developers.cloudflare.com/d1/reference/data-security/)

| 데이터 | 현재 사용처·저장 위치 | 출시 전 결정할 사항 |
| --- | --- | --- |
| 이름·이메일·전화번호·언어 | `customers`, 예약 입력과 관리자 화면 | 연락 수단을 모두 필수로 받아야 하는지, 예약 종료 후 보유 기간, 삭제 요청 처리 방법 |
| 날짜·시간·인원·시술·금액 | `reservations` | 업무상 보관 기록과 개인 식별자를 분리할지, 정산·분쟁 대응 범위 |
| 요청사항 | `reservations.special_requests` | 건강·의료정보 등 불필요한 민감 정보 입력을 피하도록 안내, 최소 보유와 접근 범위 |
| 메일 수신처·발송 오류 | `notifications`, 메일 제공업체 | 발송 이력 보유 기간, 오류 응답에 포함된 개인정보 제거, 제공업체 쪽 보관 범위 |
| 관리자 알림 대기·발송 기록 | `admin_booking_alerts` | 예약 연결, 관리자 수신처가 포함된 발송 요청과 결과의 보관 기한 |
| 상담 인계 요약·연락처·관리자 메모 | `agent_handoffs` | 원문 복사 최소화, 처리 완료 후 보관 기한, 삭제 책임자 |
| export·Time Travel·운영 로그 | Cloudflare 및 별도 저장 위치 | 접근 권한, 만료·파기 방식, 복원 후 삭제 요청 재적용 방법 |

`components/booking/steps/DetailsStep.tsx`는 현재 고객 정보 입력을 받지만 개인정보 수집 안내·보유 기간 안내와 고지 버전 기록이 없다. 운영 주체, 이용 목적, 필수/선택 항목, 보유 기간, 처리업체와 문의·삭제 요청 창구를 확정해 예약 폼에서 쉽게 볼 수 있도록 연결해야 한다. 동의가 처리 근거인 항목은 서버에서 고지 버전과 동의 시각을 검증·기록하고 선택 항목을 분리한다. 실제 사업 소재지·고객 대상·처리 목적이 확정되지 않아 이 문서에서 법정 보유 기간을 임의로 지정하지 않는다.

파기는 단순한 목록 숨김과 별도로 설계한다. 만료된 HOLD와 과거 구현에서 남았을 수 있는 미참조 고객, 완료·취소 예약, 알림 수신처, 상담 인계와 백업까지 대상으로 정한다. 삭제 예정 수량을 먼저 확인하는 모드, 실행 결과 기록, 처리 중인 예약을 보존하는 조건, 외래키를 지키는 처리 순서를 마련한다. 업무상 필요한 집계는 개인 식별자와 자유 입력 내용을 제거한 뒤 보관할 수 있도록 분리한다. 보유 기간에 따른 자동 파기와 예약 폼의 개인정보 고지는 아직 구현되지 않았다.

## AI와 관리자 접근

`app/api/agent/chat/route.ts`는 고객이 입력한 대화와 도구 실행 결과를 Gemini에 전송한다. `GEMINI_API_KEY`가 설정되었다는 사실만으로 개인정보 처리에 적절한 계약·결제 상태가 확인되지는 않는다.

Google의 Gemini 약관은 Unpaid Services에 개인정보·민감정보 제출을 금지하며, 입력과 출력이 서비스 개선에 사용될 수 있다고 명시한다. Gemini API의 Paid Services 해당 여부는 요청에 사용한 프로젝트에 활성 결제 계정이 연결되어 있는지에 달려 있다. Paid에서는 제품 개선에 프롬프트·응답을 사용하지 않지만 보안 목적 등의 제한적 로그 처리는 남아 있다. 실제 프로젝트의 결제 상태와 데이터 처리 조건, 서비스 제공 가능 지역을 확인하기 전에는 AI에 고객 개인정보를 받지 않고 일반 예약 폼으로 운영한다. [Gemini API 추가 약관](https://ai.google.dev/gemini-api/terms)

`middleware.ts`의 관리자 Basic Auth는 값이 없으면 접근을 거부한다. 관리자 페이지와 Server Action도 `requireAdmin()`을 호출하여 데이터 접근 전에 인증한다. 공유 비밀번호 한 쌍으로는 직원별 권한·퇴사자 접근 회수·누가 예약을 변경했는지의 감사 기록을 제공하지 못한다. 운영에서는 개별 계정과 MFA, 최소 권한, 관리자 변경 이력을 적용한다. Cloudflare에서 접근을 제한한다면 운영 도메인 외 Worker 미리보기 주소까지 같은 보호가 적용되는지 확인한다.

공개 예약·AI API의 요청 제한과 남용 방지도 출시 전에 확인한다. 저장소에 명시적인 rate limit/Turnstile 구현은 없고, Cloudflare 대시보드의 외부 규칙은 이번 검토에서 확인하지 않았다. 예약번호나 고객이 입력한 이메일 자체를 신원 증명으로 사용하지 않는다.

서버 비밀키는 `NEXT_PUBLIC_` 접두어를 사용하지 않고 환경별 비밀 저장소로 관리한다. `.env.example`에는 변수 이름과 예시만 둔다. `.gitignore`는 `.env*`, `.dev.vars*`, `/backups/`를 제외한다. Git 제외는 백업 파일 암호화나 접근 권한 설정을 대신하지 않는다.

## 운영자가 먼저 정할 세 가지

1. **알림 수신함과 담당자:** 실제로 확인할 업무용 메일 주소, 영업 중 미확인 예약 점검 담당자와 간격을 정한다. 휴대폰 메일 알림도 켜고 테스트 예약으로 수신을 확인한다.
2. **개인정보 보유·삭제 기준:** 완료·취소 예약 연락처와 요청사항, 상담 인계, 발송 이력·백업을 언제 지울지와 삭제 요청 창구를 정한다. 실제 사업에 적용되는 보존 의무를 확인한 뒤 고지 문구와 자동 파기 작업에 반영한다.
3. **AI 출시 범위:** 일반 예약 폼으로 먼저 운영하거나, Gemini 프로젝트의 결제·처리 조건과 고객 안내를 확인한 뒤 AI 예약을 함께 연다. 일반 폼부터 시작하면 AI 처리 조건 확인과 독립적으로 예약 운영을 검증할 수 있다.
