# Woori Aroma 预约系统

[한국어](./README.md) | [English](./README.en.md) | [中文](./README.zh.md)

这是济州中文洞私人水疗中心 **Woori Aroma** 的多语言预约/运营平台。完整的产品/架构说明见
`proposal.md`。

## 环境要求

- Node.js **22.5.0 或以上**（使用内置的 `node:sqlite` 模块 — 参见 `package.json` 的 `engines`）

## 快速开始

```bash
npm install
npm run dev
```

客户预约网站请访问 [http://localhost:3000](http://localhost:3000)（`/en`、`/ko`、`/zh`、`/ja`），
仅限韩语的管理后台请访问 [http://localhost:3000/admin](http://localhost:3000/admin)。

本地开发无需任何环境变量 — 应用会自动使用本地 SQLite 数据库
`.data/woori-aroma.sqlite3`（已加入 gitignore），未配置邮件服务时也会安全地跳过发送。只有在接入
真实邮件服务商时，才需要把 `.env.example` 复制为 `.env.local`。

**⚠️ `/admin` 目前尚未接入身份验证。** 本地开发环境下是安全的，但在加入身份验证之前，不能公开部署到
生产环境 — 详见 `proposal.md` §11。

## 脚本命令

```bash
npm run dev        # 启动开发服务器
npm run build       # 生产环境构建
npm run start        # 运行生产环境构建
npm run lint          # eslint 检查
npm run typecheck      # tsc --noEmit
npm test                # vitest — 业务逻辑 / API 路由 / 管理后台功能 / agent 工具
```

## 项目结构

```text
app/[locale]/book/    客户预约向导（基于 next-intl 路由）
app/admin/             仅限韩语的管理后台（不做语言路由）
app/api/                 预约相关 API 路由处理程序
app/api/cron/reminders/    24 小时提醒触发端点（由外部调度器调用）
lib/booking/               纯业务逻辑（可预约时段、价格、校验）
lib/admin/                   管理后台专用逻辑（确认邮件文案生成、状态/标签、可删除性判断）
lib/notifications/           多渠道通知服务（见下文）
lib/db/                     SQLite 客户端 + 数据库迁移
lib/repositories/             数据访问层，每个表/聚合对应一个文件
lib/agent/                     Gemini agent 工具层（尚未接入大模型）
data/services.ts                  疗程目录（价格的唯一数据来源）
messages/{en,ko,zh,ja}.json          面向客户的多语言翻译文件
tests/                                 vitest 测试套件
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

### 所需环境变量（均为服务器端专用，详见 `.env.example`）

| 渠道 | 变量 |
|---|---|
| 邮件 — Resend | `RESEND_API_KEY`、`RESEND_FROM_EMAIL` |
| 邮件发送安全开关 | `EMAIL_DELIVERY_MODE`、`EMAIL_TEST_RECIPIENT` |
| 提醒定时任务 | `CRON_SECRET` |

本地开发环境下这些均不是必需的 —— 未配置邮件服务商时，系统只会记录一条
`provider_not_configured` 日志并跳过发送。

### 各服务商接入说明

- **Resend**：在 resend.com 注册账号 → 验证发信域名 → 创建 API key。
- **邮件发送安全开关**：除非明确设置为 `production`，否则 `EMAIL_DELIVERY_MODE` 始终按 `sandbox`
  （沙盒）模式运行（包括未设置或拼写错误的情况 —— 参见 `lib/notifications/recipientPolicy.ts`）。
  在沙盒模式下，所有自动发送的邮件（预约请求已收到/取消/提醒）以及 `/admin/send-confirmation`
  中的手动发送，都会被重定向到 `EMAIL_TEST_RECIPIENT`，而不是发给真实客户；若未设置该变量，则会
  直接跳过发送。"发送测试邮件"按钮无论处于哪种发送模式，始终只发送到 `EMAIL_TEST_RECIPIENT`。
- **提醒定时任务**：为 `CRON_SECRET` 生成一个足够长的随机字符串，然后让外部调度器
  （Vercel Cron、服务器 crontab 中的 `curl`、GitHub Actions 定时任务等均可）以
  `Authorization: Bearer <CRON_SECRET>` 请求头调用 `POST /api/cron/reminders`。建议至少每小时
  执行一次；由于该任务具备幂等性，更频繁地执行也是安全的。

自动发送的邮件（预约请求已收到/取消/提醒）会以内嵌附件的形式包含 `public/sketchmap.png`
路线示意图（参见 `lib/notifications/mapAttachment.ts`）。取消邮件默认不包含该地图。

### 已知限制

- `RESERVATION_UPDATED` 事件目前还没有实际的触发点 —— 因为目前代码库中还没有"修改/改期预约"这项
  功能。该事件类型、邮件模板以及服务商对接都已经准备就绪，只是目前尚未在任何地方被调用。
- 本项目使用的数据库 `node:sqlite` 假定运行在长期存活的 Node 进程中；提醒定时任务的端点为此特意
  设计为与部署环境无关，但数据库本身的选型与该功能并无直接关系，不在其讨论范围内。

## 了解更多

本项目基于 [Next.js](https://nextjs.org)（App Router）+ TypeScript + Tailwind CSS + `next-intl` 构建。
