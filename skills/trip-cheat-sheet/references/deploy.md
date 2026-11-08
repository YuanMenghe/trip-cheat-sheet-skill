# 部署与分享（deploy）

> 这份文档讲三件事：**构建产物怎么部署**、**单文件和多文件怎么选**、**怎么只把某人的票券页发给他，以及密码门能挡什么、挡不住什么**。
> 生成器用法见 [`trip-schema.md`](./trip-schema.md) / [`../SKILL.md`](../SKILL.md)。

## 1. 先看产物：两种模式，输出什么

### 单文件（默认，不加 `--multi`）

```bash
node scripts/build.mjs examples/tokyo-conference/trip.json --out dist
```

```text
dist/
├── index.html          # CSS / JS / 数据 / PWA manifest 全部内嵌（约 100 KB）
└── assets/qr-*.svg     # 仅当 tickets[].qr 指向本地图片时复制；data:/http(s) 的 QR 不复制
```

- 可以双击 `index.html` 离线打开；
- 发给别人只要发 `index.html`（若还有二维码资源，连 `assets/` 一起发）；
- 想做「真正只有一个文件」，把 `tickets[].qr` 换成 `data:` URI 或外链 URL。

### 多文件站点（`--multi`）

```bash
node scripts/build.mjs examples/tokyo-conference/trip.json --multi --out dist
```

```text
dist/
├── index.html             # 主页面（引用 assets/ 与 manifest.json）
├── ticket-<id>.html       # 每张票券一个独立页面，可单独分享
├── manifest.json          # PWA manifest（--no-pwa 时不生成）
└── assets/
    ├── style.css
    ├── app.js
    └── qr-*.svg           # 按 trip.json 里的相对路径复制
```

- `ticket-<id>.html` 里的 `<id>` 就是 `trip.json` 的 `tickets[].id`（例如 `ticket-badge-a.html`）；
- 票券页带 `noindex`，但仍然是**公开可访问**的页面（见 §5）；
- 主页面和票券页都依赖 `assets/`，**不能只传一个 HTML**。

## 2. 单文件 vs 多文件怎么选

| 场景 | 建议 | 原因 |
|---|---|---|
| 只给自己/家人用，发微信或存手机 | **单文件** | 一个 HTML 就能看，离线也行 |
| 部署成长期站点、经常更新 | 单文件或多文件都行 | 单文件重传一个文件；多文件结构更清晰、缓存友好 |
| 要按人分享票券页 | **多文件** | 每张票有独立 `ticket-<id>.html` |
| 需要按人「最小权限」分享 | **多文件** | 只发对应票券页，不暴露整份行程 |
| 要密码门 | 两种都支持 | 密码门只保护主页面，票券页不弹密码框（见 §6） |
| 离线保存、打印、邮件附件 | **单文件** | 无外部依赖（注意本地 QR 资源） |

## 3. 部署到 GitHub Pages

### 3.1 本仓库的演示站

仓库自带 `.github/workflows/pages.yml`：

- 推送到 `main` 触发；
- job `build-and-deploy` 构建示例数据并发布 Pages；
- 演示地址：<https://yuanmenghe.github.io/trip-cheat-sheet-skill/>。

> 本地想复现演示：`node scripts/build.mjs examples/tokyo-conference/trip.json --out demo --force`，再把 `demo/` 当站点预览（不要提交构建产物）。

### 3.2 部署自己的行程（三种方式）

**方式 A：GitHub Actions（推荐给长期维护的站点）**

1. 把行程目录（如 `trips/tokyo-2026/trip.json`）提交到仓库；
2. 复制/修改仓库里的 `.github/workflows/pages.yml`，把构建输入改成你的 `trip.json`（`--out` 指向工作流上传的目录）；
3. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**；
4. push 后等 Actions 跑完，站点地址为 `https://<用户名>.github.io/<仓库名>/`。

**方式 B：把 `dist/` 推到 `gh-pages` 分支（不需要改 workflow）**

```bash
# 1) 本地构建
node scripts/build.mjs trips/tokyo-2026/trip.json --out dist --force

# 2) 把 dist 内容推到 gh-pages 分支
cd dist
git init -b gh-pages
git add .
git commit -m "trip page"
git remote add origin https://github.com/<you>/<repo>.git
git push -f origin gh-pages
```

然后在 **Settings → Pages** 里把 **Branch** 设为 `gh-pages`、目录选 `/ (root)`，保存。地址是 `https://<you>.github.io/<repo>/`。

**方式 C：把 `dist/` 放进仓库的 `docs/` 目录**

1. `node scripts/build.mjs trips/tokyo-2026/trip.json --out docs --force`；
2. 提交 `docs/`；
3. **Settings → Pages** 选择当前分支、目录 `/docs`。

三种方式选一种即可；单文件模式只需要 `index.html`（若含二维码资源再加 `assets/`），多文件模式上传整个 `dist/`。

> **注意**
> - Pages 站点有自己的 URL，**仓库是私有不代表页面私有**：默认情况下页面公开可访问，不要依赖「仓库私有」保护内容。
> - 私有仓库开启 Pages 通常需要付费计划；同时确认仓库的 Actions 权限允许部署 Pages。
> - 更新后等 Actions/缓存刷新；手机端如果还是旧页面，强制刷新或换无痕窗口验证。

### 3.3 自定义域名（可选）

Settings → Pages → Custom domain 填域名并按提示配置 DNS（CNAME/A 记录 + HTTPS 证书）。中文字体、相对路径、`manifest.json` 的 `start_url: './'` 都不依赖域名，换域名不用改构建。

## 4. 部署到 Cloudflare Pages

### 4.1 Direct Upload（最简单）

1. 本地构建：`node scripts/build.mjs trip.json --multi --out dist --force`；
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Upload assets**；
3. 把 `dist/` 整个目录拖进去，得到 `https://<project>.pages.dev`。

### 4.2 连接 Git 仓库（自动构建）

1. Cloudflare Dashboard → Pages → **Connect to Git**，选择仓库；
2. **Framework preset**：`None`；
3. **Build command**（本仓库示例，在仓库根目录执行）：
   ```bash
   node skills/trip-cheat-sheet/scripts/build.mjs skills/trip-cheat-sheet/examples/tokyo-conference/trip.json --out dist
   ```
   如果 `scripts/` 就在你的仓库根目录，则用：
   ```bash
   node scripts/build.mjs trip.json --out dist
   ```
4. **Build output directory**：`dist`；
5. 如构建镜像的 Node 版本过低，在 **Settings → Environment variables** 加 `NODE_VERSION=18`（或 20），重新部署。

Cloudflare Pages 的免费额度、预览部署和自定义域名都在控制台里配置；和 GitHub Pages 一样，它只是静态托管，密码门仍然是前端校验。

### 4.3 用 wrangler CLI 发布（可选）

```bash
npx wrangler pages deploy dist --project-name <project-name>
```

首次使用会要求登录 Cloudflare；适合脚本化发布。

## 5. 部署到任意静态托管

`dist/` 就是纯静态文件，任何能托管 HTML 的地方都行：

| 托管 | 做法 | 注意 |
|---|---|---|
| Netlify | 把 `dist/` 拖到 Netlify Drop，或连接 Git 后设置 build command | 单文件模式可直接拖一个 HTML |
| Vercel | 静态项目，输出目录设为 `dist` | 同左 |
| 对象存储（OSS/COS/S3 等） | 上传 `dist/`，开启静态网站托管 | 必须设置默认首页 `index.html`；确认 `Content-Type`（HTML 为 `text/html`） |
| 自有服务器 / nginx | 把 `dist/` 放进站点目录，`index` 指向 `index.html` | 多文件模式确保 `assets/` 与 HTML 同级 |
| 本地预览 | 双击 `dist/index.html`，或 `npx serve dist`、`python -m http.server --directory dist` | 多文件 + 密码门建议用 `http://localhost` 打开 |

通用检查：

- 访问站点根路径能打开 `index.html`（否则会 404 或目录列表）；
- 多文件模式确认 `assets/style.css`、`assets/app.js` 与 `index.html` 同级可访问；
- 路径大小写敏感（Linux/对象存储），`ticket-<id>.html` 的 `<id>` 与文件名完全一致；
- 如果站点部署在子路径（如 `https://example.com/trip/`），相对路径仍然有效，无需改构建。

## 6. 只分享某人的票券页

### 多文件模式（推荐）

1. 构建：`node scripts/build.mjs trip.json --multi --out dist`；
2. 找到 `dist/ticket-<id>.html`，例如 `ticket-badge-a.html`；
3. 上传整个 `dist/`，把链接 `https://<站点>/ticket-badge-a.html` 发给 A；
4. 如果只想传最小集合：`ticket-<id>.html` + `assets/style.css` + `assets/app.js` + 该票的二维码资源（如 `assets/qr-a.svg`）。页面里的「返回行程」链接会 404，这是正常的。

**注意**：票券页里内嵌了 `meta`（标题、页脚）和 `siblings`（其他票券的人名/标题，用于顶部切换），分享前快速过一眼，确认不包含你不想暴露的信息。

### 单文件模式

链接形如 `https://<站点>/index.html#ticket-badge-a`，会直接打开该票券视图；但**同一页里还有全部行程和其他人的票**，只适合内部共享，不适合「只给 A 看」。

### 隐私提醒

- 票券页带 `<meta name="robots" content="noindex">`，只是「不建议搜索引擎收录」，**不等于私有**；
- 公开 URL = 任何拿到链接的人都能看；
- 真二维码是真凭证，不要放进公开托管；配送方式优先私聊/当面，或使用托管平台的访问控制（如 Cloudflare Access）、私有云盘、加密压缩包；
- 密码门**不保护**多文件模式的 `ticket-<id>.html`（见下一节）。

## 7. 密码门（SHA-256 前端校验）

### 7.1 怎么用

```bash
node scripts/build.mjs trip.json --gate-password "your-password" --out dist
```

- 构建时把密码做 SHA-256，写入页面的 `meta.gate = { enabled: true, passwordHash: "<64 位 hex>" }`；
- 打开主页面时会要求输入密码，浏览器本地计算 SHA-256 与 `passwordHash` 比对；
- 校验通过后记在**当前浏览器**的 `localStorage`（key 含页面标题哈希），同一浏览器下次免输；换浏览器/清缓存要重输；
- 忘记密码无法找回，重新构建一个新密码即可：`node scripts/build.mjs trip.json --gate-password "new-password" --out dist --force`。

也可以手写 `trip.json`（哈希为 64 位小写 hex）：

```json
"gate": { "enabled": true, "passwordHash": "<sha256-hex-of-password>" }
```

手动计算（Node）：

```bash
node -e "console.log(require('node:crypto').createHash('sha256').update('your-password').digest('hex'))"
```

### 7.2 边界：它能挡什么、挡不住什么

| 能挡 | 挡不住 |
|---|---|
| 熟人拿到链接、随手打开的「手滑」 | 懂前端的人：内容就内嵌在 HTML/JSON 里，看源码或禁用 JS 即可绕过 |
| 不认识的访客误入 | 暴力破解：哈希可离线枚举，弱密码/常用密码很快被猜出 |
| 简单分享时的一层门槛 | 搜索引擎/爬虫（页面仍是公开 URL） |
| — | 多文件模式的 `ticket-<id>.html`：**当前实现只给主页面挂密码门**，票券页直接打开 |

补充：

- 密码门依赖浏览器 `crypto.subtle`。通过 `file://` 直接双击打开时，个别浏览器会提示「当前浏览器不支持本地校验」——改用 `http://localhost` 或部署后的 HTTPS 地址；
- 它**不是加密**，只是把内容「藏在」一个校验后面；真正的敏感内容（身份证件、完整票码、银行卡、健康信息）不要放进任何公开托管的页面；
- 需要真正的访问控制时，用托管平台的能力：GitHub Pages 的企业级访问控制、Cloudflare Access、私有网盘分享、临时签名链接，或干脆不部署、只本地保存；
- 公开发布前仍然要跑一遍 `verify.mjs`（内含疑似手机号/长数字编号的隐私警告）并人工检查 `copy` 字段与票券页。

## 8. 更新、缓存与回滚

- **更新**：改 `trip.json` → 重新构建（输出目录非空加 `--force`）→ 重新上传/推送 → 等托管平台刷新；
- **缓存**：Pages 有 CDN 缓存，通常几分钟内生效；手机端用强制刷新（或无痕窗口）验证；PWA 加到主屏后可能需要重新打开才会更新；
- **回滚**：Git 分支/提交回退最简单（GitHub Pages、Cloudflare Pages 都支持重新部署旧提交）；手动上传的托管保留上一版 `dist/` 备份再覆盖；
- **别提交构建产物**：`dist/`、`demo/` 是生成物；用 `.gitignore` 排除，CI 构建或本地构建后再部署。

## 9. 发布前检查清单

1. `node scripts/verify.mjs <trip.json> --strict` 通过（0 错误、0 警告）；
2. 没有真实票码/二维码/证件号/手机号/住址（`copy` 字段用占位符）；
3. 航班时刻、营业时间、预约状态都有来源或明确标「待核实」，`meta.footer` 写了数据截止日期；
4. 手机上竖屏打开一遍：行程/清单/手册三视图、地图按钮、复制按钮、票券页都能用；
5. 多文件模式：`index.html`、`assets/`、`ticket-*.html` 都上传了，链接逐个点开；
6. 密码门（如有）：用另一台设备/浏览器验证需要输密码，且确认自己知道边界；
7. 分享范围确认：公开站点不要放「只给某个人看」的内容。
