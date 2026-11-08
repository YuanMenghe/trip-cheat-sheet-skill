---
name: trip-cheat-sheet
description: Turn trip materials (flight/hotel screenshots, conference agenda, tickets, links) into a mobile-friendly travel cheat-sheet web page with an itinerary timeline, checklists, destination handbook, dual-timezone clocks, map deep links, QR ticket pages and an optional password gate; outputs a single-file HTML page or a multi-page static site ready for GitHub Pages. Use when the user asks for a travel itinerary, trip planner, conference trip preparation, business-trip plan, 行程规划, 出差/参会行程, 行程攻略, 随身页, 旅行手册, 清单, or asks to organize bookings and screenshots into one page. Keywords — itinerary, travel itinerary, trip planner, conference trip, travel cheat sheet, trip prep, 行程, 攻略, 随身页, 手册, 清单.
license: MIT
compatibility: Requires Node.js 18+ (ESM + full IANA timezone data via Intl). Build and verify run offline; only the research step needs network access.
---

# TripCheat · AI 行程规划专家（`trip-cheat-sheet`）

把用户散落的航班、酒店、会议议程、门票、攻略截图和聊天记录，整理成**一个随身网页**：
**行程时间线**（今天几点去哪）、**清单**（别忘了什么）、**手册**（怎么走/怎么付/出问题找谁）。
手机打开即用，支持双时区、深色主题、字号调节、地图深链、二维码票券，可部署到任何静态托管。

页面由本 skill 自带的生成器从**一份 `trip.json`** 构建：数据契约见 [`references/trip-schema.md`](references/trip-schema.md)，写作规范见 [`references/content-guide.md`](references/content-guide.md)，部署见 [`references/deploy.md`](references/deploy.md)。

## 何时使用

**触发场景**

- 「帮我做个行程」「把机票、酒店、会议议程整理成一页」「出差/参会准备」
- 「行程攻略」「随身页」「旅行手册」「出行清单」「每天几点干嘛」
- 用户给了一堆截图 / PDF / 邮件 / 链接 / 聊天记录，需要**结构化 + 补调研 + 做成可随身查看的页面**
- 已有 `trip.json`：要重新生成页面、改主题、加密码门、部署或分享票券页

**不适用**

- 只需要查某个景点介绍、天气、订票：直接搜索/回答，不必做页面
- 需要实时库存、下单、付款、值机：本 skill 不接预订 API，只整理信息与链接
- 纯路线导航：用地图工具，不需要行程页

## 产出物

| 模式 | 命令 | 产物 |
|---|---|---|
| 单文件（默认） | `node scripts/build.mjs trip.json --out dist` | `dist/index.html`（CSS/JS/数据/PWA manifest 全内嵌）+ 按需复制的票券图片 |
| 多文件站点 | `node scripts/build.mjs trip.json --multi --out dist` | `dist/index.html`、`dist/ticket-<id>.html`、`dist/assets/style.css`、`dist/assets/app.js`、`dist/manifest.json`、复制的票券资源 |

页面能力：行程时间线 / 清单 / 手册三视图；「当前/下一件事」高亮；双时区时钟与时间换算；主题（paper/slate/night）与字号切换；Google/高德/Apple 地图深链（Google 路线链接带出行方式参数）；清单勾选（本机 localStorage）；票券二维码页；可选密码门（前端 SHA-256 校验）；可加到主屏（PWA，`--no-pwa` 关闭）。

## 工作流（6 步）

### 第 1 步：收集资料（首轮 6 个问题 + 材料）

先发一轮问卷，**最多 6 个问题**（把下面信息合并成 6 问，不要逐条盘问）。用户没答的用默认假设，并显式标注「假设：…」。

| # | 问什么 | 必须拿到的最小信息 |
|---|---|---|
| 1 | **行程性质与骨架** | **公差 / 私差 / 混合**（混合要写清哪几天是公差）；谁去/几人/关系（老人/小孩/无障碍）、出发地、日期（含跨日/红眼）、目的地（是否多城市/中转） |
| 2 | **已订 / 待订** | 航班、酒店、会议注册、门票、餐厅哪些已订（有确认单发来）、哪些待订或未定 |
| 3 | **关键时间** | 会议/活动的注册、开幕、自己的报告/海报时段、晚宴，以及其他必须准点的事 |
| 4 | **住宿与报销（公差/混合必答，私差跳过）** | 住近会场/行程点（效率优先）还是晚上逛街吃饭方便（生活半径优先），冲突时以哪个为准；公差：是否可报销、住宿标准上限、发票类型（增值税发票/收据/水单）、抬头税号、是否要求协议价/公司渠道/预授权；私差：预算与住宿偏好即可 |
| 5 | **偏好与底线** | 预算、饮食忌口/过敏、节奏强度（暴走/松弛）、想放弃什么；餐饮能否接受排队、是否愿意提前订位 |
| 6 | **隐私与分发** | 是否要部署/公开分享、是否要密码门、哪些信息不能上网（真实票码/证件号/住址等） |

**公差 / 私差 / 混合 = 三条不同路径**（先分清，再动手）：

| 性质 | 优先目标 | 必做模块 | 写作差异 |
|---|---|---|---|
| **business 公差** | 效率、准点、报销合规 | `handbook` 加「报销与票据」章；清单加审批/行程单/发票抬头；住宿受公司标准约束 | 少排景点、留体力给会议；发票抬头税号与行程单写进 `copy`；不把会议敏感信息放进公开页 |
| **leisure 私差** | 体验、预算、灵活 | 门票/餐厅预约、交通卡、保险与紧急电话 | 可多排景点与夜间活动；预约与排队规则优先；预算与取舍写清 |
| **mixed 混合** | 分段清晰 | 同时具备上面两者；`meta.footer` 写清哪几天是公差 | 日程按「公差段 / 私人段」分开写；发票与报销只覆盖公差段；私事不要混进报销口径 |

**让用户一起发来的材料（有多少发多少）**

- 航班 / 酒店 / 门票 / 会议注册的确认单、邮件、PDF、截图
- 会议议程、邀请函、自己的报告或海报摘要
- 想去的景点 / 餐厅的链接或截图（小红书、点评、官网都行）
- 已有行程表（Excel / Word / 飞书文档）也可以直接丢过来

**首轮消息模板（可直接复制给用户）**

```text
给我这 6 项就能开工（不知道的写「不确定」）：
1) 行程性质：公差 / 私差 / 混合（混合请说哪几天是公差）· 谁去（几人/关系/有无老人小孩）· 从哪出发 · 哪天到哪天 · 目的地（含中转/多城市）
2) 已订了什么（航班/酒店/会议注册/门票/餐厅，有确认单直接发）· 什么还没定
3) 必须准点的事（会议注册/开幕/报告/海报/晚宴等）
4) 住宿：想住会场/景点附近（省通勤）还是晚上逛街吃饭方便？冲突听哪个？
   公差/混合：能否报销？住宿上限 / 发票类型 / 抬头税号 / 是否必须协议价（私差跳过报销，直接说预算）
5) 预算、饮食忌口或过敏、节奏（暴走 or 松弛）、最想放弃什么；餐厅愿不愿意排队/提前订位
6) 要公开分享还是自己看？要不要密码门？哪些信息不能上网
材料：确认单 / 议程 / 邀请函 / 想去的店和景点链接，有多少发多少。
```

拿到答复后，**先整理成事实清单再动手写 JSON**，不要边收集边猜；缺的信息按 P0→P1→P2（见第 2 步）调研补齐。

### 第 2 步：深度调研（联网，区分「已确认」与「待核实」）

按优先级调研，并把来源链接与核查日期记下来：

| 优先级 | 调研内容 |
|---|---|
| P0 | 签证/护照有效期、航班/车次、住宿、会议注册/门票、保险 |
| P1 | 机场 ↔ 市区交通（末班车、航站楼）、市内交通票、门票分时预约、餐厅预订 |
| P2 | 景点、购物、备选方案、天气 |

- 优先官方来源：航司/机场/铁路、酒店、会议官网、博物馆/景点官网、使领馆、交通运营方。
- 每条关键信息分四类措辞：**已确认 / 待核实 / 未定 / 示例**（规则见 `references/content-guide.md` §6）。
- 不要编造价格、班次、开放时间、预约状态；查不到就写「待核实」并给「以官方为准」的兜底。
- 常见坑（机场交通、门票预约、Wi-Fi、支付、紧急电话、时区/DST）逐项核对，写进手册或事件说明。

#### 三条必须验证的选择：路线、餐厅、住宿

| 对象 | 必须做的验证 | 写进 `trip.json` 的位置 |
|---|---|---|
| **游玩/转场路线** | 用**地图软件**（Google/高德/腾讯/当地交通官方）核验方式与耗时，不靠攻略估；写清步行距离、换乘、末班车；记录核验日期 | `detail`（「约 X 分钟，地图核验于 YYYY-MM-DD」）+ `map.mode` |
| **餐厅** | **平台评分 + 小红书真实体验**交叉参考（小红书只作个人体验参考，不能当唯一证据）；必须确认**能否预约、怎么预约、排队规则、休息日/营业时间**；人均与着装写清 | `detail` + `links`（官方/预订页）；预约状态按 §6 标注 |
| **住宿** | ① 到会场/行程点的**通勤**（步行/地铁耗时、末班车、雨天方案）② **晚上生活半径**（餐饮/购物/便利店/安全）③ **报销合规**（发票类型、抬头税号、住宿标准、预授权/押金、退改）④ 预算 | `detail`（选择理由 + 放弃项）、`handbook` 的「住宿」章、`checklists`（发票/押金提醒） |

- 拒绝「攻略说大约 20 分钟」这类无来源写法：要么给核验日期与来源，要么标「待核实」。
- 餐厅信息分三档：平台评分（参考）、小红书/朋友（个人体验，待核实）、官方/预订渠道（营业/预约以它为准）。
- 住宿先定优先级再选：**效率（近会场）> 夜间生活（热闹便利）> 报销合规 > 预算**（顺序由用户确认）；`detail` 里写「选这是因为…；放弃了…」。

### 第 3 步：写 `trip.json`

严格按 [`references/trip-schema.md`](references/trip-schema.md) 写；可直接参考示例
[`examples/tokyo-conference/trip.json`](examples/tokyo-conference/trip.json)。

- `meta`：标题、副标题、常驻地（`home`）、起止日期、主题、地图供应商、页脚（写数据截止日期）。
- `destinations`：每个目的地一个 `id` + IANA 时区（如 `Asia/Tokyo`）。
- `days[].events`：每条事件至少写 `time` / `title` / `short` / `detail` / `kind`；有地点的写 `location` + `map`；有官方链接的写 `links`；能关联清单的写 `checkId`。
- `checklists`：按阶段分组（出发前 / 落地后 / 期间 / 返程前），`id` 全局唯一。
- `handbook`：交通、**住宿**、网络、支付、安全应急、参会、饮食、打包等章节（住宿章写入住/退房/发票报销/行李寄存；**公差/混合另加「报销与票据」章**：发票类型、抬头税号、行程单、审批单、公司卡/个人垫付；可合并/增补，主题别漏）。
- `tickets`：每人一张，`qr` 指向占位图或用户自备图片（**不要提交真实票码**）。

**双时区规则（最容易错）**

1. `time` / `endTime` 都是**事件当地的时间**；`tz` 不填时继承当天目的地的时区。
2. 航班跨时区时 `tz` 表示**起飞地时区**，且 `endTime` 也按该 `tz` 解释。合并成一条航班时，`endTime` 要写「落地时刻换算到起飞地时区」的值，并在 `detail` 写清「落地当地时间 HH:MM」；更省事的做法是**把起飞、落地拆成两条事件**，各自用自己的当地时区。
3. 跨日到达放到次日 `days[]`，`detail` 写「+1 天」/「次日」；跨午夜事件的 `endTime` 小于 `time` 时会按次日处理，但仍建议文字说明。
4. 全天无时刻的安排用 `skipTimezone: true`；时区一律写 IANA 名称，不要写 `UTC+9`、`JST`。
5. 页面会自动把时间换算成常驻地时间，**正文不要重复手写换算**，除非是「值机开放/远程会议」这类必须在出发前按常驻地时间行动的事。

### 第 4 步：构建

在 skill 根目录（含 `scripts/`、`templates/` 的目录）执行；脚本按当前工作目录解析路径，也可在任意目录用完整路径运行。

```bash
node scripts/build.mjs <trip.json> --out dist
```

常用参数：

```bash
# 多文件站点（生成可单独分享的 ticket-<id>.html）
node scripts/build.mjs trip.json --multi --out dist

# 覆盖主题 / 加密码门 / 关闭 PWA / 覆盖非空输出目录 / 安静模式
node scripts/build.mjs trip.json --theme night --gate-password "your-password" --out dist
node scripts/build.mjs trip.json --no-pwa --out dist
node scripts/build.mjs trip.json --force --quiet --out dist
```

- 默认输出 `dist/index.html`；`--out` 默认 `dist`。
- **`build` 内部先跑同一套数据校验**，有 errors 会退出码 1，不会生成半成品；warnings 会打印但不阻塞。
- 输出目录已存在且非空时必须加 `--force`（会先清空该目录）。
- `--help` 查看全部参数。

### 第 5 步：校验

```bash
node scripts/verify.mjs <trip.json>          # 默认：errors 失败（退出码 1），warnings 只提示
node scripts/verify.mjs <trip.json> --strict # warnings 也算失败（发布前推荐）
node scripts/verify.mjs <trip.json> --quiet  # 只输出错误摘要
```

校验覆盖：`meta` 必填与合法时区/日期、`destinations` 引用、`days/events` 时间格式与 `tz` 合法性、链接协议、`handbook` HTML 白名单、`tickets.qr` 文件存在性，以及**隐私扫描**（疑似手机号/长数字编号会给警告）。警告要么修掉，要么能解释清楚。

### 第 6 步：预览与部署

- **本地预览**：直接用浏览器打开 `dist/index.html`（单文件可双击）；多文件建议起本地服务器：
  ```bash
  npx serve dist
  # 或 python -m http.server --directory dist
  ```
- **部署**：见 [`references/deploy.md`](references/deploy.md)（GitHub Pages / Cloudflare Pages / 任意静态托管）。
- **分享票券页**：多文件模式的 `ticket-<id>.html` 可单独发给对应的人；单文件模式用 `#ticket-<id>` 锚点，但同页含所有人内容。
- **隐私提醒**：公开站点 = 任何人可见。真实二维码、票码、证件号、手机号不要放进公开页面；密码门只是前端校验（详见 `deploy.md`）。

## 调用示例

### 示例 1：东京学术会议（示例数据同款）

```text
用户：我 11 月 20–24 日去东京开学术会议，两个人（A/B），这是航班和酒店的截图、议程链接；
      帮我把注册、开幕、海报、晚宴都排进去，做成手机上随时能看的页面。

Agent：
1. 收集资料 → 问清 3 件事：酒店订单是否含早餐、A/B 各自的参会证类型、回程值机时间
2. 调研 → 羽田→市区的交通方式与末班车、会场与酒店的位置关系、落地入境用时
3. 写 trip.json → 参考 examples/tokyo-conference/trip.json（示例把航班合并为一条、endTime 按起飞地时区换算）
4. 构建 → node scripts/build.mjs trips/tokyo-2026/trip.json --multi --out dist
5. 校验 → node scripts/verify.mjs trips/tokyo-2026/trip.json --strict
6. 预览 → 打开 dist/index.html；提出部署到 GitHub Pages / 把 ticket-badge-a.html 发给 A
```

### 示例 2：家庭出境游（多目的地 + 双时区 + 保险信息）

```text
用户：暑假带爸妈去西班牙 10 天，马德里进巴塞罗那出，帮我做个行程，要能查地铁和紧急电话。

Agent：
- destinations 写两个（Madrid / Barcelona，时区 Europe/Madrid 与出发地对比）
- handbook 重点写：机场↔市区、地铁票、支付与小费、紧急电话与使馆、饮食（老人忌口）
- 事件里写清「为什么」与「放弃项」（如「今天不去丽池，留体力给王宫」）
- build 后跑 verify，把 dist 部署到 GitHub Pages，链接发给家人
```

### 示例 3：已有数据更新 + 只分享某人的票券页

```text
用户：行程改了：晚宴从 23 日改到 24 日 19:30，另外把我老婆的参会证页单独发我。

Agent：
1. 改 trip.json 里对应 event 的 time/detail（保留「已确认」措辞与来源）
2. node scripts/build.mjs trip.json --multi --out dist --force
3. node scripts/verify.mjs trip.json
4. 把 dist/ticket-badge-b.html 单独分享；提醒：公开链接会暴露二维码，建议只给本人或加访问控制
```

## 质量红线

1. **不编造**：价格、班次、开放时间、预约状态、电话必须有来源；没有就写「待核实」+「以官方为准」。
2. **已确认 vs 待核实**：用户确认单/官方页面 = 已确认；第三方平台/旧截图/攻略 = 待核实；固定措辞见 `content-guide.md` §6，不要用「据说」「应该」。
3. **双时区**：`time` 写事件当地时间；航班合并写时 `endTime` 按事件 `tz`（起飞地时区）换算，`detail` 写落地当地时间；跨日拆到次日；时区只用 IANA 名称。
4. **隐私与票码**：不把真实二维码、票码、PNR、证件号、手机号、住址写进要公开的页面；`copy` 用占位符；示例数据必须虚构脱敏；仓库只放占位二维码。
5. **不承诺能力**：不承诺实时库存/预订/值机；下单、付款、退改等不可逆操作交给用户，不替用户执行。
6. **交付前必跑校验**：`verify.mjs --strict` 零错误再交付；部署前再确认没有敏感信息。
7. **说明边界**：密码门是熟人分享级保护，不是加密；要真安全用私有托管/访问控制。
8. **路线/餐厅/住宿必须验证**：路线用地图软件核验并写时间区间与核验日期；餐厅参考平台评分 + 小红书真实体验，并确认能否预约、怎么预约；住宿写清通勤、夜间生活便利与报销条件。小红书/攻略只作个人体验参考，不能替代官方预约与评分。
9. **公差/私差分开写**：先定 `meta.tripType`；公差要写发票/行程单/审批与公司住宿标准，私差只谈预算与体验；混合行程分段标注，报销口径只覆盖公差段，不要把私事写进报销清单，也不要把会议敏感信息混进公开页面。

## 单文件 vs 多文件怎么选

| 需求 | 选单文件（默认） | 选多文件（`--multi`） |
|---|---|---|
| 发给家人/同事、微信/邮件、离线双击 | ✅ 一个 HTML 最省事 | 不建议（要整目录） |
| 部署成站点、长期使用、随时更新 | 可以（每次重传一个文件） | ✅ 缓存友好、结构清晰 |
| 按人单独分享票券页 | ❌ 用锚点会暴露同一页其他人的票 | ✅ `ticket-<id>.html` 独立页面 |
| 想彻底一个文件（含二维码） | 把 `tickets[].qr` 换成 `data:` URI 或外链 URL | — |
| 需要密码门 | ✅ 支持（主页面与页内票券视图都弹） | ✅ 主页面与 `ticket-<id>.html` 都会弹密码框（同一密码，同一浏览器解锁一次） |

> 注意：单文件模式会把 `qr` 指向的本地图片**自动内联为 `data:` URI**，产物真的只有一个 HTML 文件；已经是 `data:`/`http(s)` 的 QR 原样保留。

## 文件地图

```text
skills/trip-cheat-sheet/
├── SKILL.md                     # 本文件：何时用、怎么用、红线
├── references/
│   ├── trip-schema.md           # 唯一数据契约（字段/时区/构建命令）
│   ├── content-guide.md         # 内容写作规范（六要素/双时区/手册章节/标注规则）
│   └── deploy.md                # 部署与分享（Pages/Cloudflare/单多文件/密码门）
├── scripts/
│   ├── build.mjs                # trip.json → 网页
│   └── verify.mjs               # trip.json 校验器（build 内部复用）
├── templates/                   # style.css / app.js / index.html / ticket.html
└── examples/tokyo-conference/   # 可跑示例（含占位二维码）
    ├── trip.json
    └── assets/qr-a.svg, qr-b.svg
```

## 常见问题

| 现象 | 处理 |
|---|---|
| `❌ 输出目录非空` | 加 `--force`，或换 `--out` 目录 |
| 页面空白/样式丢失 | 多文件模式必须把整个 `dist/`（含 `assets/`）一起上传；确认 `index.html` 与 `assets/` 同级 |
| 时间显示不对 | 检查 `tz` 拼写（IANA 名称）；合并航班时 `endTime` 是否按起飞地时区换算 |
| `verify` 有警告 | 修掉，或确认可接受后交付；`--strict` 会失败 |
| 忘了密码门密码 | 重新构建：`node scripts/build.mjs trip.json --gate-password "新密码"` |
| 部署后 404 | 检查 Pages 分支/目录设置、Actions 是否跑完、文件名大小写 |
| Node 版本报错 | 用 Node.js ≥ 18（需要完整 `Intl` 时区数据与 ESM） |

## English quick reference

- **What**: generate a mobile-first travel cheat-sheet web page from one `trip.json` — itinerary timeline, checklists, destination handbook, dual-timezone display, map deep links, QR ticket pages, optional password gate, PWA.
- **Build**: `node scripts/build.mjs <trip.json> --out dist` (single file, default) or `--multi` (static site with `ticket-<id>.html`). Flags: `--theme paper|slate|night`, `--gate-password`, `--no-pwa`, `--force`, `--quiet`.
- **Verify**: `node scripts/verify.mjs <trip.json> [--strict] [--quiet]`.
- **Contract**: `references/trip-schema.md`; writing rules: `references/content-guide.md`; deployment: `references/deploy.md`.
- **Never**: fabricate prices/schedules, mix up timezones, or commit real ticket codes, QR images, IDs or phone numbers. Mark verified vs unverified content explicitly.
