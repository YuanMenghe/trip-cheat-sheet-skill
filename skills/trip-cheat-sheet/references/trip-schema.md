# trip.json 数据模型（生成器唯一契约）

`build.mjs` **只认这一个 JSON**。Agent 的职责是把用户资料（截图 / PDF / 链接 / 聊天）整理成下面的结构，再跑构建。
所有字段除非标注"可选"，其余必填；`verify.mjs` 会逐项校验。

## 顶层

```jsonc
{
  "meta": { /* 见下 */ },
  "destinations": [ { "id": "tyo", "label": "东京", "tz": "Asia/Tokyo" } ],
  "days": [ /* 行程：按日期排列 */ ],
  "checklists": [ /* 清单：分组 */ ],
  "handbook": [ /* 手册：章节 */ ],
  "tickets": [ /* 票券/二维码页，可选 */ ]
}
```

## meta

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | ✅ | 站点主标题，如「东京 · 学术会议 2026」 |
| `subtitle` | string | — | 副标题，如「5 天 4 夜 · 2 人」 |
| `tripType` | `"business" \| "leisure" \| "mixed"` | — | 行程性质：**公差 / 私差 / 混合**。公差需要报销与审批信息、住宿常受公司标准约束；私差关注预算与体验；混合要在 `meta.footer` 或 `days[].note` 写清哪几天是公差。生成器会校验取值，`verify` 会对公差/混合缺少「报销与票据」章给出警告。 |
| `home` | `{label, tz}` | ✅ | 出发/常驻地：`label` 如「北京」，`tz` 为 IANA 时区 |
| `theme` | `"paper" \| "slate" \| "night"` | — | 默认 `paper`（暖纸），`night` 为深色 |
| `lang` | string | — | 默认 `zh-CN` |
| `startDate` / `endDate` | `YYYY-MM-DD` | ✅ | 行程首尾日期 |
| `mapProvider` | `"google" \| "amap" \| "apple"` | — | 默认 `google`；中国场景可用 `amap`（高德 URI） |
| `pwa` | boolean | — | 默认 `true`，生成 manifest 与主屏图标 meta |
| `gate` | `{enabled, passwordHash}` | — | 可选密码门：`passwordHash` 为密码的 SHA-256（hex）；`build.mjs --gate-password xxx` 可自动生成 |
| `footer` | string | — | 页脚备注（如「内容截至 2026-11-10，出行前请复核」） |
| `showTimezone` | boolean | — | 默认 `true`：每条事件显示「目的地时间 → 北京时间」 |

## destinations

```json
{ "id": "tyo", "label": "东京", "tz": "Asia/Tokyo" }
```
`id` 用于 `days[].destination` 引用；支持多目的地（如中转城市）。

## days 与 events

```json
{
  "date": "2026-11-20",
  "destination": "tyo",
  "title": "出发 · 抵达东京",
  "note": "可选：当天的整体提示",
  "events": [
    {
      "time": "08:00",
      "endTime": "11:30",
      "tz": "Asia/Shanghai",
      "skipTimezone": false,
      "title": "PEK → HND",
      "short": "飞东京",
      "detail": "北京 08:00 起飞（东京当地 09:00），预计东京当地 12:30 落地。endTime 按 tz（起飞地）写成本时间 11:30；更推荐把起飞、落地拆成两条事件，各自用当地时区。",
      "kind": "flight",
      "location": "羽田机场 T3",
      "map": { "query": "羽田机场第3航站楼", "mode": "transit" },
      "links": [ { "label": "航班动态", "href": "https://example.com" } ],
      "checkId": "check-flight"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `time` / `endTime` | 事件**所在时区的本地时间** `HH:MM`；`endTime` 可选 |
| `tz` | 可选；不填则用该 `day.destination` 的时区。**航班跨时区时必填**，表示起飞地时区 |
| `skipTimezone` | 可选；`true` 时不显示北京时间换算（如"全天自由活动"） |
| `title` / `short` | 标题 / 短标签（时间轴、通知用） |
| `detail` | 说明文字，支持纯文本；换行用 `\n` |
| `kind` | `flight \| move \| meeting \| meal \| visit \| check \| free`，决定图标与颜色 |
| `location` / `map` | 地点名 / 地图查询参数 + 出行方式（`walking\|transit\|driving\|bicycling`） |
| `links` | 相关官方链接（票务/餐厅/议程），页面渲染为按钮 |
| `checkId` | 可选，关联清单项 id：该事件完成后可勾选对应清单项 |

## checklists（清单）

```json
[
  {
    "id": "before",
    "title": "出发前",
    "items": [
      {
        "id": "check-flight",
        "title": "值机并保存登机牌",
        "detail": "航班起飞前 48h 开放；把 PDF 存本地",
        "copy": "PNR: 示例 6 位",
        "links": [ { "label": "官网值机", "href": "https://example.com" } ]
      }
    ]
  }
]
```
- `id`：全局唯一；`checkId` 与事件关联。
- `copy`：可选，渲染为「一键复制」按钮。
- 勾选状态存浏览器 localStorage（按站点 key 隔离，不上传）。

## handbook（手册）

```json
[
  {
    "id": "transport",
    "title": "交通",
    "sections": [
      {
        "id": "airport",
        "title": "羽田 → 市区",
        "html": "<p>京急线……</p><ul><li>约 25 分钟</li></ul>",
        "copy": [ { "label": "酒店地址", "value": "东京都……" } ]
      }
    ]
  }
]
```
- `html` 允许基础标签（p/ul/ol/li/b/strong/em/a/br/code/mark/small），生成器做白名单清洗。
- `copy`：一键复制字段。
- 手册页支持搜索（匹配标题 + 正文纯文本）。

## tickets（票券 / 二维码）

```json
[
  {
    "id": "badge-a",
    "title": "参会证",
    "person": "A",
    "qr": "assets/qr-a.svg",
    "hint": "屏幕调亮，正对扫码口",
    "links": [ { "label": "议程", "href": "https://example.com" } ]
  }
]
```
- `qr`：图片路径（相对 `trip.json`）；示例仓库只放**占位图**，真实二维码由用户自备、不要提交到公开仓库。
- 单文件模式：在页面内用 `#ticket-<id>` 打开；多文件模式：另外生成 `ticket-<id>.html`，可单独分享给当事人。

## 时区与"双时区"规则

1. `day.destination` 决定当天默认时区；`event.tz` 可覆盖（航班、跨区当晚）。
2. 页面把每条事件换算成 `meta.home.tz` 并显示（如「07:30 东京 · 06:30 北京」）。
3. 时钟区显示「常驻地 + 当前/下一目的地」两个实时时钟；跨第三时区（如迪拜转机）用事件级 `tz` 单独标注。
4. 构建时用 `Intl.DateTimeFormat` 校验所有时区合法；校验器同时检查 `startDate ≤ day.date ≤ endDate`。

## 构建命令

```bash
# 单文件（默认）
node scripts/build.mjs examples/tokyo-conference/trip.json --out dist

# 多文件站点（票券页可单独分享）
node scripts/build.mjs examples/tokyo-conference/trip.json --multi --out dist

# 指定主题 / 加密码门
node scripts/build.mjs trip.json --theme night --gate-password "your-password" --out dist
```
