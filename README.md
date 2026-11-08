# TripCheat · AI 行程规划专家

> 把散落的航班截图、酒店确认单、会议议程和攻略，变成**一页手机上随手能查的行程**：
> **行程时间线 · 清单 · 手册**，双时区、地图深链、二维码票券，一个文件或一个静态站点。

**License** MIT · **Runtime** Node.js ≥ 18 · **在线演示** <https://yuanmenghe.github.io/trip-cheat-sheet-skill/>（单文件版：<https://yuanmenghe.github.io/trip-cheat-sheet-skill/tripcheat-single.html>）· **Agent Skill** `trip-cheat-sheet`

> 徽章暂用文字占位（不使用第三方徽章图片）。截图来自示例数据的真实渲染，更多效果见 demo 站点。

## 这是什么

TripCheat 是一个开源的 [Agent Skill](https://agentskills.io)：装进 Claude Code、Codex、Cursor、OpenCode、DSH、OpenClaw 等支持 Agent Skills 的客户端后，你只要把行程资料交给 Agent（截图 / PDF / 邮件 / 链接 / 聊天记录），它就会：

1. **深度调研**（航班、机场交通、门票预约、支付、紧急电话……），区分「已确认」与「待核实」；
2. 写成一份结构化的 `trip.json`（唯一数据契约）；
3. 用自带的 `build.mjs` 生成一个**双时区、可离线打开、可部署**的随身网页；
4. 用 `verify.mjs` 校验后交付，并给出部署与分享方式。

它不是又一个「攻略生成器」——它生成的是**到了现场能照着执行**的东西：几点出门、为什么这样排、放弃什么、出问题找谁。

## 功能截图

**截图见 demo 站点：<https://yuanmenghe.github.io/trip-cheat-sheet-skill/>**

| 行程时间线（双时区） | 清单 | 手册 |
|---|---|---|
| ![行程时间线：日期切换、当前/下一件事高亮、目的地时间与常驻地时间](docs/screenshots/mobile-itinerary.png) | ![清单：按阶段分组、可勾选、可一键复制](docs/screenshots/mobile-checklist.png) | ![手册：章节搜索、交通/网络/支付/安全](docs/screenshots/mobile-handbook.png) |

> 上图为示例数据的真实构建产物截图（`docs/screenshots/`）；桌面端、深色主题、票券页等更多截图见同目录，完整交互见 demo 站点。

## 特性

- **三视图**：行程时间线 / 清单 / 手册，底部标签一页切换；「当前 / 下一件事」高亮。
- **双时区**：目的地实时时钟 + 常驻地时钟，每条事件自动显示「目的地时间 → 常驻地时间」；航班、中转、跨日单独处理。
- **单文件 / 多文件**：默认输出一个自包含 HTML（发给家人、离线双击都能用）；`--multi` 输出可部署的静态站点，并为每张票券生成独立页面。
- **票券页**：二维码放大展示、按人分享、屏幕提示；示例仓库只放占位二维码。
- **地图深链**：按 `meta.mapProvider` 生成 Google / 高德 / Apple 地图链接（Google 路线链接带出行方式参数）。
- **清单**：勾选状态只存本机浏览器（localStorage），不上传；`copy` 字段一键复制地址、预约号、电话。
- **手册**：支持搜索，HTML 白名单清洗，适合写「怎么走 / 怎么付 / 出问题找谁」。
- **调研有标准**：路线必须用地图软件核验（时间区间、末班车、步行距离）；餐厅参考平台评分 + 小红书真实体验（只作个人体验）并确认能否预约；住宿写清通勤、夜间生活便利与报销（发票/标准/押金）条件，以及选址取舍。
- **公差 / 私差 / 混合三条路径**：`meta.tripType` 区分行程性质——公差自动要求报销与票据章（发票抬头/行程单/审批单/公司卡）、住宿受公司标准约束；私差关注预算与体验；混合分段标注、发票口径只覆盖公差段。页面头部会显示对应徽章。
- **时间与上下文细节**：同一时区（如新加坡与北京同为 UTC+8）自动只显示一个时间、顶部标「同时区」；远期行程不会自动滚动跳走，保留日期条与出发提示。
- **主题与字号**：paper（暖纸）/ slate（冷灰）/ night（夜间）三种主题，小/标准/大/特大四种字号，默认跟随系统深色模式。
- **PWA**：可加到手机主屏（`--no-pwa` 可关闭）。
- **密码门**：`--gate-password` 前端 SHA-256 校验 + 本机记忆，熟人分享级保护（边界见 [deploy.md](skills/trip-cheat-sheet/references/deploy.md)）。
- **零后端**：纯静态产物，可部署 GitHub Pages / Cloudflare Pages / 任意静态托管。
- **数据契约 + 校验器**：`trip-schema.md` 定义字段，`verify.mjs` 检查引用、时区、链接、HTML 白名单，并做隐私扫描（疑似手机号/长编号）。

## 安装

通用约定：**每个 skill 一个目录，目录里必须有 `SKILL.md`**。把本仓库的 `skills/trip-cheat-sheet/` 整个目录复制到对应客户端的 skills 目录即可（保留 `references/`、`scripts/`、`templates/`、`examples/`，它们是 skill 的一部分）。

```bash
git clone https://github.com/YuanMenghe/trip-cheat-sheet-skill.git
```

| 客户端 | 安装位置（全局 / 项目） | 说明 |
|---|---|---|
| **Claude Code** | `~/.claude/skills/trip-cheat-sheet/` / `.claude/skills/trip-cheat-sheet/` | 个人 skill 全部项目可用；项目 skill 随仓库共享 |
| **Codex**（OpenAI） | `~/.agents/skills/trip-cheat-sheet/` / 仓库内 `.agents/skills/trip-cheat-sheet/` | Codex 会从当前目录向上扫描 `.agents/skills`；用 `$` 或 `/skills` 触发 |
| **Cursor** | `~/.cursor/skills/trip-cheat-sheet/` 或 `~/.agents/skills/trip-cheat-sheet/` / `.cursor/skills/`、`.agents/skills/` | Cursor 自动发现 `.agents/skills` 与 `.cursor/skills` |
| **OpenCode** | `~/.config/opencode/skills/trip-cheat-sheet/` / `.opencode/skills/trip-cheat-sheet/` | 也兼容 `~/.agents/skills`；用 `@<skill-id>` 触发 |
| **DSH**（DeepSeek Harness） | `~/.agents/skills/trip-cheat-sheet/`（Windows：`%USERPROFILE%\.agents\skills\`） | 也扫描项目内 `.dsh/skills`、`.agents/skills` 与 `$DSH_HOME/skills` |
| **OpenClaw** | `~/.agents/skills/trip-cheat-sheet/`（个人）或 `<workspace>/skills/`（工作区） | 也可 `openclaw skills install ./skills/trip-cheat-sheet --global` |
| **其他 agentskills.io 客户端** | 该客户端的 skills 目录 | 遵循 [Agent Skills 规范](https://agentskills.io/specification)：一个目录 + `SKILL.md`，其余目录可选 |

复制示例（macOS / Linux）：

```bash
mkdir -p ~/.agents/skills
cp -R trip-cheat-sheet-skill/skills/trip-cheat-sheet ~/.agents/skills/
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null
Copy-Item -Recurse "trip-cheat-sheet-skill\skills\trip-cheat-sheet" "$HOME\.agents\skills\"
```

> 不确定用哪个目录时，先看对应客户端文档中「skills」的路径；再不行就装到 `~/.agents/skills/`（多数新客户端都认这个跨工具目录）。

## 3 分钟快速开始

要求：Node.js ≥ 18（需要完整 `Intl` 时区数据）。

```bash
# 1) 克隆
git clone https://github.com/YuanMenghe/trip-cheat-sheet-skill.git
cd trip-cheat-sheet-skill

# 2) 进入 skill 目录（脚本与示例都在这里）
cd skills/trip-cheat-sheet

# 3) 构建示例行程（东京学术会议，5 天 4 夜）
node scripts/build.mjs examples/tokyo-conference/trip.json --out dist

# 4) 校验（可选但推荐；发布前用 --strict）
node scripts/verify.mjs examples/tokyo-conference/trip.json

# 5) 打开 dist/index.html（macOS：open dist/index.html；Windows：start dist\index.html）
```

构建成功后输出类似：

```text
✅ TripCheat 已生成（单文件页面，主题 paper）
   输出：.../skills/trip-cheat-sheet/dist
   - index.html  ...
```

想生成可部署的多文件站点（每张票券一个独立页面）：

```bash
node scripts/build.mjs examples/tokyo-conference/trip.json --multi --out dist
```

**用 Agent 生成你自己的行程**：装好 skill 后，直接说：

> 「我 11 月 20–24 日去东京开学术会议，这是航班、酒店和议程截图，帮我做一个手机上能看的行程页，双时区，能勾清单，能部署。」

Agent 会按 `SKILL.md` 的 6 步工作流收集资料 → 调研 → 写 `trip.json` → 构建 → 校验 → 给出部署方式。

## 常用命令

在 skill 根目录执行（路径按当前工作目录解析，也可在任意目录用完整路径）：

```bash
# 单文件（默认）
node scripts/build.mjs <trip.json> --out dist

# 多文件站点（index.html + ticket-<id>.html + assets/）
node scripts/build.mjs <trip.json> --multi --out dist

# 换主题 / 加密码门 / 关 PWA / 覆盖非空输出 / 安静模式
node scripts/build.mjs <trip.json> --theme night --gate-password "your-password" --out dist
node scripts/build.mjs <trip.json> --no-pwa --out dist
node scripts/build.mjs <trip.json> --force --quiet --out dist

# 校验：errors 失败（退出码 1）；--strict 把 warnings 也算失败
node scripts/verify.mjs <trip.json> [--strict] [--quiet]

# 本地预览多文件站点
npx serve dist
```

完整参数与字段说明：[`trip-schema.md`](skills/trip-cheat-sheet/references/trip-schema.md)。

## 目录结构

```text
trip-cheat-sheet-skill/
├── README.md
├── LICENSE                          # MIT
├── .github/workflows/pages.yml      # push main 时构建示例并发布 Pages
├── docs/screenshots/                # README 截图（示例数据的真实渲染）
└── skills/trip-cheat-sheet/
    ├── SKILL.md                     # skill 入口：何时用、6 步工作流、质量红线
    ├── references/
    │   ├── trip-schema.md           # 唯一数据契约（字段 / 时区 / 命令）
    │   ├── content-guide.md         # 内容写作规范（六要素 / 双时区 / 手册章节 / 标注）
    │   └── deploy.md                # 部署与分享（Pages / Cloudflare / 票券 / 密码门）
    ├── scripts/
    │   ├── build.mjs                # trip.json → 网页
    │   └── verify.mjs               # trip.json 校验器
    ├── templates/                   # 页面模板与样式（build 时内联或复制）
    │   ├── index.html
    │   ├── ticket.html
    │   ├── style.css
    │   └── app.js
    └── examples/tokyo-conference/   # 可直接构建的示例（虚构、脱敏）
        ├── trip.json
        └── assets/qr-a.svg, qr-b.svg
```

## 文档

- [SKILL.md](skills/trip-cheat-sheet/SKILL.md)：skill 的完整说明与工作流
- [trip-schema.md](skills/trip-cheat-sheet/references/trip-schema.md)：`trip.json` 数据契约
- [content-guide.md](skills/trip-cheat-sheet/references/content-guide.md)：内容写作规范（事件六要素、双时区、手册章节、研究优先级）
- [deploy.md](skills/trip-cheat-sheet/references/deploy.md)：GitHub Pages / Cloudflare Pages / 静态托管、单多文件、票券分享、密码门

## License

[MIT](LICENSE)。示例行程（`examples/tokyo-conference/`）为完全虚构的演示数据：航班、酒店、编号、票码均为占位，不构成任何真实预订；二维码为不可扫的占位图。使用真实数据时，请自行确认并妥善保管个人隐私与票券凭证。

## 贡献

欢迎 issue 与 PR：

- 新增示例行程：在 `skills/trip-cheat-sheet/examples/<name>/` 下放 `trip.json`（必要时加占位二维码），先跑 `node scripts/verify.mjs <trip.json> --strict`，再跑一遍 `build.mjs` 确认可构建；
- 改数据契约：同步更新 `references/trip-schema.md`、`scripts/build.mjs`、`scripts/verify.mjs`、示例与文档，并在 PR 里说明兼容性；
- 改进内容规范或部署文档：保持中文为主，涉及新客户端时同步更新安装表；
- **不要提交真实票码、二维码、证件号、手机号或他人隐私**；截图请打码或使用示例数据；
- 提交前自测：`verify.mjs --strict` 通过 + 浏览器里打开构建产物检查行程/清单/手册/票券四类页面。

---

# TripCheat — AI itinerary planner (English)

**TripCheat** is an open-source [Agent Skill](https://agentskills.io) that turns scattered travel materials (flight and hotel screenshots, conference agenda, tickets, links, chat logs) into **one mobile-friendly web page** with three views: **itinerary timeline, checklists, and a destination handbook** — dual timezone, map deep links, QR ticket pages, single-file or multi-page output, deployable to any static host.

> Demo: <https://yuanmenghe.github.io/trip-cheat-sheet-skill/> · License: MIT · Runtime: Node.js ≥ 18 · Skill name: `trip-cheat-sheet`

## What it does

1. **Collects** your materials and asks a short clarifying round (who, when, what is booked, what matters).
2. **Researches** the trip online (airport transfers, ticket reservations, payments, emergency numbers), explicitly separating **verified** from **unverified** facts and citing official sources.
3. **Writes** a single `trip.json` following the data contract.
4. **Builds** a static, offline-capable travel page with `scripts/build.mjs`.
5. **Verifies** the data with `scripts/verify.mjs` (required fields, timezones, links, HTML whitelist, privacy scan).
6. **Ships** it: preview locally, deploy to GitHub Pages / Cloudflare Pages / any static host, or share one person's ticket page.

## Features

- Three views: itinerary timeline, checklist, destination handbook; “current / next event” highlighting.
- Dual timezone: destination clocks plus home clocks, per-event conversions; flight, transit and cross-day handling.
- Single-file HTML (default) or multi-page static site (`--multi`) with per-person `ticket-<id>.html` pages.
- QR ticket pages, map deep links (Google / Amap / Apple), one-tap copy fields, checklist state saved in `localStorage`.
- **Research standards**: routes verified with map apps (time ranges, last trains, walking distances); restaurants cross-checked with platform ratings + Xiaohongshu real experiences (personal experience only) and confirmed for reservation availability; hotels justified by commute, nightlife/shopping access, and reimbursement rules (invoice type, cap, deposit).
- **Business / leisure / mixed tracks**: `meta.tripType` drives what gets generated — business trips require an expense & receipts chapter (invoice header, tax ID, itinerary, approval, corporate card) and hotels respect company caps/channels; leisure trips focus on budget and experience; mixed trips are split by segment with reimbursement scoped to the business leg.
- Themes (paper / slate / night), font size switch, PWA install, optional password gate.
- Data contract + validator; zero backend; pure static output.
- Example data is fictional and sanitized; QR images in the repo are placeholders only.

## Install

An Agent Skill is a directory containing a `SKILL.md`. Copy `skills/trip-cheat-sheet/` into your client's skills directory:

| Client | Path |
|---|---|
| Claude Code | `~/.claude/skills/trip-cheat-sheet/` (personal) or `.claude/skills/trip-cheat-sheet/` (project) |
| Codex | `~/.agents/skills/trip-cheat-sheet/` (user) or `.agents/skills/trip-cheat-sheet/` (repo) |
| Cursor | `~/.cursor/skills/trip-cheat-sheet/` or `~/.agents/skills/trip-cheat-sheet/` (project: `.cursor/skills/`, `.agents/skills/`) |
| OpenCode | `~/.config/opencode/skills/trip-cheat-sheet/` (global) or `.opencode/skills/trip-cheat-sheet/` (project) |
| DSH (DeepSeek Harness) | `~/.agents/skills/trip-cheat-sheet/` (`%USERPROFILE%\.agents\skills\` on Windows) |
| OpenClaw | `~/.agents/skills/trip-cheat-sheet/` (personal) or `<workspace>/skills/trip-cheat-sheet/` |
| Other Agent Skills clients | that client's skills directory — one folder per skill, `SKILL.md` inside |

```bash
git clone https://github.com/YuanMenghe/trip-cheat-sheet-skill.git
mkdir -p ~/.agents/skills
cp -R trip-cheat-sheet-skill/skills/trip-cheat-sheet ~/.agents/skills/
```

## Quick start (3 minutes)

```bash
git clone https://github.com/YuanMenghe/trip-cheat-sheet-skill.git
cd trip-cheat-sheet-skill/skills/trip-cheat-sheet
node scripts/build.mjs examples/tokyo-conference/trip.json --out dist
node scripts/verify.mjs examples/tokyo-conference/trip.json
# open dist/index.html
```

Multi-page site (one shareable page per ticket):

```bash
node scripts/build.mjs examples/tokyo-conference/trip.json --multi --out dist
```

Ask your agent (after installing the skill):

> "I'm attending a conference in Tokyo, Nov 20–24. Here are my flight, hotel and agenda screenshots. Build me a mobile trip page with dual timezones, checklists and a deployable site."

## Documentation

- [SKILL.md](skills/trip-cheat-sheet/SKILL.md) — when and how the skill runs, quality rules
- [trip-schema.md](skills/trip-cheat-sheet/references/trip-schema.md) — `trip.json` data contract
- [content-guide.md](skills/trip-cheat-sheet/references/content-guide.md) — writing rules (six event elements, dual timezone, handbook chapters)
- [deploy.md](skills/trip-cheat-sheet/references/deploy.md) — GitHub Pages, Cloudflare Pages, static hosting, ticket sharing, password gate limits

## License & contributing

MIT. Example data is entirely fictional; QR images are placeholders. Never commit real ticket codes, QR images, ID numbers, phone numbers, or other people's private data. Contributions are welcome: add examples under `skills/trip-cheat-sheet/examples/<name>/`, keep `trip-schema.md`, scripts, examples and docs in sync, and run `node scripts/verify.mjs <trip.json> --strict` before opening a PR.

