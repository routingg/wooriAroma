# Woori Aroma 预约系统

[한국어](./README.md) | [English](./README.en.md) | [中文](./README.zh.md)

正式上线前，请先阅读 [管理员通知·隐私·数据库运维指南](./docs/operations-readiness.md)（仅韩语）。
管理员新预约邮件及失败重试功能可在 `/admin/notifications` 查看。更新时需应用新的数据库迁移，并在
`.env.example` 中配置好管理员通知相关变量及外部重试调度器。
基于保留期限的自动数据销毁、以及面向客户的隐私声明，目前均尚未实现。
在向真实客户开放 AI 预约助手之前，请务必确认 Gemini API 的计费与数据处理条款 —— 详见上述运维指南中的
"AI 与管理员访问" 部分。

这是济州中文洞私人水疗中心 **Woori Aroma** 的多语言预约/运营平台。完整的产品/架构说明见
`proposal.md`，开发进度见 `report.md`。

**正式上线：[https://wooriaroma.site](https://wooriaroma.site)（www.wooriaroma.site）** — 部署在
Cloudflare Workers 上（见 `wrangler.jsonc`）。

## 环境要求

- Node.js **22.5.0 或以上**（参见 `package.json` 的 `engines`）

## 快速开始

```bash
npm install
wrangler d1 migrations apply woori-aroma-db --local   # 首次运行前，为本地 D1 填充schema
npm run dev
```

客户预约网站请访问 [http://localhost:3000](http://localhost:3000)（`/en`、`/ko`、`/zh`、`/ja`），
仅限韩语的管理后台请访问 [http://localhost:3000/admin](http://localhost:3000/admin)。
店内平板电脑用来接待新客人的欢迎屏幕（kiosk）请访问
[http://localhost:3000/welcome](http://localhost:3000/welcome)（无需登录，也不做语言路由）。

连接数据库无需配置任何环境变量 — `next.config.ts` 中的 `initOpenNextCloudflareForDev()`
会自动绑定本地 Cloudflare D1（上面的迁移命令只需执行一次）。未配置邮件服务时也会安全地跳过发送。
只有在接入真实邮件服务商时，才需要把 `.env.example` 复制为 `.env.local`。

**⚠️ `/admin` 已接入 HTTP Basic Auth 身份验证。** 采用失败即拒绝（Fail-Closed）策略 —— 若未设置
`ADMIN_BASIC_AUTH_USER`/`ADMIN_BASIC_AUTH_PASSWORD`，所有请求都会被拒绝，因此本地开发也需要配置
这两个变量 — 详见 `.env.example`。

## 脚本命令

```bash
npm run dev        # 启动开发服务器
npm run build       # 生产环境构建
npm run start        # 运行生产环境构建
npm run lint          # eslint 检查
npm run typecheck      # tsc --noEmit
npm test                # vitest — 业务逻辑 / API 路由 / 管理后台功能 / agent 工具
npm run cf:preview        # OpenNext 构建 + Cloudflare 本地预览
npm run cf:deploy          # OpenNext 构建 + 部署到 Cloudflare
```

## 项目结构

```text
app/[locale]/book/         客户预约向导（基于 next-intl 路由）
app/[locale]/              首页 —— 包含 Gemini AI 预约助手的入口按钮和聊天对话框
app/welcome/                 店内平板欢迎屏幕（kiosk，无需登录，也不做语言路由）
app/admin/                  仅限韩语的管理后台（统一布局，含侧边栏导航）
app/admin/blocked-times/      屏蔽时段设置 + 预约前后的准备/清理缓冲时间设置
app/admin/notifications/       管理员新预约通知的发送/重试状态
app/admin/agent-handoffs/       AI 助手转接给人工处理的对话记录
app/admin/send-confirmation/     为线下/手动预约立即发送确认邮件
app/api/                    预约相关 API 路由处理程序
app/api/agent/chat/           Gemini function-calling 预约助手接口
app/api/cron/reminders/        24 小时提醒触发端点（由外部调度器调用）
app/api/cron/notifications/     管理员通知发送失败后的重试触发端点（由外部调度器调用）
lib/booking/                 纯业务逻辑（可预约时段、价格、缓冲时间、校验）
lib/admin/                    管理后台专用逻辑（确认邮件文案生成、状态/标签、可删除性判断）
lib/notifications/             多渠道通知服务（见下文）
lib/solapi.ts                    基于 Solapi 的管理员新预约短信提醒
lib/db/                        Cloudflare D1 客户端 + 数据库迁移
lib/repositories/                数据访问层，每个表/聚合对应一个文件
lib/agent/                        Gemini agent 工具层（已接入 Function Calling）
data/services.ts                     疗程目录（价格的唯一数据来源）
messages/{en,ko,zh,ja}.json             面向客户的多语言翻译文件
tests/                                    vitest 测试套件
docs/operations-readiness.md                正式上线前需要确认的通知/隐私/数据库事项
```

## 预约与邮件工作流程

提交预约请求并不代表立即确认。系统也不收取订金 —
客户只需提交预约请求，实际付款在到店时进行。

```text
客户提交预约请求（无需付款）
        │
        ▼
预约状态：待确认 (PENDING)  ← 此时会自动发送
                              "预约请求已收到" 邮件
        │
        ▼
管理员核对档期后，将状态改为"已确认"
        │
        ▼
管理员在 /admin/reservations 中查看/编辑确认邮件文案，
然后复制纯文本版或设计版（HTML）
        │
        ▼
管理员通过 Gmail 等邮箱手动发送
        │
        ▼
管理员手动将其标记为"已发送"（与预约状态分开单独管理）
```

当预约状态变为**已完成、已取消或未到店**后，管理员可以将其从工作列表中删除。这是一次软删除
（`deleted_at`）— 数据库中的记录本身不会被物理删除，历史记录得以保留；只是不再出现在常规列表、
搜索结果和统计数据中。

## 通知系统

`lib/notifications/service.ts` 是唯一了解邮件服务商（Resend）细节的地方 —
预约相关的业务代码从不直接调用它。每一次发送尝试 —— 无论成功、失败还是被跳过 —— 都会记录到
`notifications` 表（`lib/repositories/notificationRepository.ts`）中，以
`(预约, 渠道, 事件类型)` 为键，这也是 24 小时提醒任务能够保证幂等（重复执行不会重复发送）的基础。

### 自动发送的邮件

| 触发时机 | 事件 |
|---|---|
| 客户提交预约请求时 | 预约请求已收到（`RESERVATION_REQUEST_RECEIVED`） |
| 管理员取消已确认的预约时 | 取消通知（`RESERVATION_CANCELLED`） |
| 到店前 24 小时（定时任务） | 提醒邮件（`RESERVATION_REMINDER`） |

### 仅支持手动发送的邮件

- **对于线上预约，确认邮件（`RESERVATION_CONFIRMED`）不会自动发送。**
  `/admin/reservations/[id]` 页面中的"邮件撰写"面板会准备好可编辑的纯文本版和设计版（HTML）文案，
  管理员可以查看、按需修改，然后自行复制并通过 Gmail 等邮箱发送。系统本身绝不会代为发送这封邮件。
- 未关联线上预约的手动/线下预约（例如电话预约），仍可以在 `/admin/send-confirmation`
  页面中立即发送 —— 该页面依然会通过 Resend 真实发送邮件。

### 管理员新预约提醒（邮件 + 短信）

只要预约状态变为 `PENDING`（普通预约表单和 AI 预约助手都会触发），系统就会通过两个渠道
提醒管理员，这与发给客户的邮件是分开独立的。

- **邮件**：会在 `admin_booking_alerts` 表中创建一条待处理记录，并立即通过 Resend 尝试发送。
  如果首次发送失败，`POST /api/cron/notifications` 会在首次尝试后的 23 小时内最多重试 6 次，
  发送进度可在 `/admin/notifications` 中查看。邮件正文中不会包含客户姓名、联系方式或特殊需求。
- **短信**：`lib/solapi.ts` 会通过 Solapi 向 `ADMIN_NOTIFICATION_PHONE` 发送一条短信（参见
  `SOLAPI_*` 相关变量）。短信没有重试队列，且发送失败不会导致预约本身保存失败。

### 所需环境变量（均为服务器端专用，详见 `.env.example`）

| 渠道 | 变量 |
|---|---|
| 邮件 — Resend | `RESEND_API_KEY`、`RESEND_FROM_EMAIL` |
| 邮件发送安全开关 | `EMAIL_DELIVERY_MODE`、`EMAIL_TEST_RECIPIENT` |
| 管理员新预约邮件提醒 | `ADMIN_NOTIFICATION_EMAIL`、`ADMIN_NOTIFICATION_ORIGIN` |
| 管理员新预约短信提醒 — Solapi | `SOLAPI_API_KEY`、`SOLAPI_API_SECRET`、`SOLAPI_SENDER_PHONE`、`ADMIN_NOTIFICATION_PHONE` |
| 提醒定时任务 | `CRON_SECRET`（`/api/cron/reminders` 与 `/api/cron/notifications` 共用） |
| Gemini AI 预约助手 | `GEMINI_API_KEY`、`GEMINI_MODEL`（可选） |

本地开发环境下这些均不是必需的 —— 未配置相应服务商时，系统会记录一条 `provider_not_configured`
日志或返回安全的兜底响应并跳过，预约功能本身不受影响。

### 各服务商接入说明

- **Resend**：在 resend.com 注册账号 → 验证发信域名 → 创建 API key。
- **邮件发送安全开关**：除非明确设置为 `production`，否则 `EMAIL_DELIVERY_MODE` 始终按 `sandbox`
  （沙盒）模式运行（包括未设置或拼写错误的情况 —— 参见 `lib/notifications/recipientPolicy.ts`）。
  在沙盒模式下，所有自动发送的邮件（预约请求已收到/取消/提醒）以及 `/admin/send-confirmation`
  中的手动发送，都会被重定向到 `EMAIL_TEST_RECIPIENT`，而不是发给真实客户；若未设置该变量，则会
  直接跳过发送。"发送测试邮件"按钮无论处于哪种发送模式，始终只发送到 `EMAIL_TEST_RECIPIENT`。
- **管理员通知重试定时任务**：设置好 `CRON_SECRET`，并让外部调度器每 5 分钟以
  `Authorization: Bearer <CRON_SECRET>` 请求头调用 `POST /api/cron/notifications`。完整配置流程
  参见 [运维指南](./docs/operations-readiness.md) 中的 "관리자 예약 알림 설정" 一节。
- **Solapi**：在 solapi.com 注册账号 → 注册发信号码 → 创建 API key/secret。
- **提醒定时任务**：为 `CRON_SECRET` 生成一个足够长的随机字符串，然后让外部调度器
  （Vercel Cron、服务器 crontab 中的 `curl`、GitHub Actions 定时任务等均可）以
  `Authorization: Bearer <CRON_SECRET>` 请求头调用 `POST /api/cron/reminders`。建议至少每小时
  执行一次；由于该任务具备幂等性，更频繁地执行也是安全的。

自动发送的邮件（预约请求已收到/取消/提醒）会以内嵌附件的形式包含 `public/sketchmap.png`
路线示意图（参见 `lib/notifications/mapAttachment.ts`）。取消邮件默认不包含该地图。

### 已知限制

- `RESERVATION_UPDATED` 事件目前还没有实际的触发点 —— 因为目前代码库中还没有"修改/改期预约"这项
  功能。该事件类型、邮件模板以及服务商对接都已经准备就绪，只是目前尚未在任何地方被调用。

## AI 预约助手（Gemini）

首页的聊天入口（`/api/agent/chat`）让客户可以用自然语言咨询疗程/价格、查询可预约时段、创建预约，
并通过"预约编号 + 匹配的邮箱或电话号码"查询预约状态。`lib/agent/` 中的 Function Calling 工具
（`lib/agent/toolDeclarations.ts`）调用的正是与人工预约表单完全相同的 `lib/booking/` 可预约时段与
校验逻辑，因此 AI 不会打破任何预约规则。对于 AI 无法处理的情况（5 人以上团体、变更/取消预约、特殊
需求等），会通过 `handoffToAdmin` 工具转交给人工处理，相关对话会记录到 `agent_handoffs` 表，可在
`/admin/agent-handoffs` 中查看。若未配置 `GEMINI_API_KEY`，聊天功能会安全地回退为
"AI assistant is temporarily unavailable" 提示，客户预约向导不受影响。

**正式面向真实客户开放前需要确认**：Gemini API 在 Unpaid 与 Paid 两种状态下的数据处理条款不同。
详细说明与建议的上线步骤，参见 [运维指南](./docs/operations-readiness.md) 中的 "AI와 관리자 접근" 一节。

## 管理后台

`/admin` 使用统一的侧边栏导航布局（`components/admin/AdminSidebar.tsx`），可以在预约列表、屏蔽时段、
通知状态、AI 转人工记录、手动确认邮件等页面之间切换。在 `/admin/blocked-times` 中，除了可以屏蔽特定
日期/时段外，还可以设置应用于每个预约前后的准备/清理缓冲时间（以分钟为单位）——
可预约时段的计算逻辑（`lib/booking/availability.ts`）会将该缓冲时间纳入考虑。

## 了解更多

本项目基于 [Next.js](https://nextjs.org)（App Router）+ TypeScript + Tailwind CSS + `next-intl` 构建，
并部署在 Cloudflare Workers（`@opennextjs/cloudflare` + Wrangler）与 Cloudflare D1 上。开发进度与部署
细节见 `report.md`。
