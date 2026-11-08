#!/usr/bin/env node
/* TripCheat · 生成器
   把 trip.json 生成一个可随身打开的行程网页。

   用法：
     node scripts/build.mjs <trip.json> [--out dist] [--multi] [--theme paper|slate|night]
                            [--gate-password <密码>] [--no-pwa] [--force] [--quiet]

   默认输出单文件 <out>/index.html（CSS/JS/数据/manifest 全内嵌）。
   --multi 输出多文件站点：index.html + ticket-<id>.html + assets/ + manifest.json。
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve, join, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateTrip } from './verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(HERE, '..');
const TEMPLATES = join(SKILL_DIR, 'templates');

const THEME_META = {
  paper: { bg: '#efe6d6', accent: '#9a3412' },
  slate: { bg: '#eef2f7', accent: '#1d4ed8' },
  night: { bg: '#0f1115', accent: '#8fb4ff' },
};
const THEMES = new Set(Object.keys(THEME_META));
const ALLOWED_TAGS = new Set(['p', 'ul', 'ol', 'li', 'b', 'strong', 'em', 'i', 'a', 'br', 'code', 'mark', 'small', 'span', 'h3', 'h4', 'blockquote']);

/* ── 参数 ── */
function usage() {
  console.log(`TripCheat · 行程页生成器

用法：
  node scripts/build.mjs <trip.json> [options]

选项：
  --out <dir>            输出目录（默认 dist）
  --multi                多文件站点（index.html + ticket-<id>.html + assets/）
  --theme <name>         paper | slate | night（覆盖 trip.json 里的 meta.theme）
  --gate-password <pwd>  开启密码门（前端 SHA-256 校验，熟人分享级保护）
  --no-pwa               不生成 PWA manifest / 主屏图标
  --force                输出目录非空时强制覆盖
  --quiet                安静模式
  --help                 显示本帮助
`);
}

function parseArgs(argv) {
  const o = { out: 'dist', multi: false, theme: null, gate: null, noPwa: false, force: false, quiet: false, input: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { o.help = true; continue; }
    if (a === '--multi') { o.multi = true; continue; }
    if (a === '--no-pwa') { o.noPwa = true; continue; }
    if (a === '--force') { o.force = true; continue; }
    if (a === '--quiet') { o.quiet = true; continue; }
    if (a === '--out') { o.out = argv[++i]; continue; }
    if (a === '--theme') { o.theme = argv[++i]; continue; }
    if (a === '--gate-password') { o.gate = argv[++i]; continue; }
    if (a.startsWith('-')) throw new Error(`未知参数：${a}`);
    if (!o.input) o.input = a;
    else throw new Error(`多余的参数：${a}`);
  }
  return o;
}

/* ── 工具 ── */
function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function jsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** 手册 HTML 白名单清洗：移除危险标签/属性，只保留文档排版标签与安全链接。 */
function sanitizeHtml(html) {
  let s = String(html || '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|input|textarea|select|button|link|meta|svg|math)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|input|textarea|select|button|link|meta|svg|math)[^>]*\/?>/gi, '');
  s = s.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    const closing = m.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;
    if (tag === 'a') {
      const m1 = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs);
      const href = m1 ? m1[1] : '';
      if (!/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href)) return '<a>';
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener">`;
    }
    return `<${tag}>`;
  });
  return s;
}

function collectAssets(data, tripDir, outDir, copied) {
  (data.tickets || []).forEach((t) => {
    const qr = String(t.qr || '');
    if (!qr || /^(https?:\/\/|data:)/i.test(qr)) return;
    if (qr.includes('..')) return;
    const src = resolve(tripDir, qr);
    if (!existsSync(src)) return;
    const dest = join(outDir, qr);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
    copied.push(qr);
  });
}

function makeFavicon(title, accent) {
  const ch = String(title || 'T').trim().charAt(0) || 'T';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${accent}"/><text x="16" y="22" text-anchor="middle" font-size="16" fill="#fffaf3" font-family="Palatino,serif">${escapeAttr(ch)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function manifestFor(data, theme, favicon) {
  return {
    name: data.meta.title || 'TripCheat 行程',
    short_name: String(data.meta.title || 'TripCheat').slice(0, 12),
    start_url: './',
    display: 'standalone',
    background_color: THEME_META[theme].bg,
    theme_color: THEME_META[theme].accent,
    lang: data.meta.lang || 'zh-CN',
    icons: [{ src: favicon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in vars ? String(vars[key] ?? '') : ''));
}

function readTpl(name) {
  return readFileSync(join(TEMPLATES, name), 'utf8');
}

function describeSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/* ── 主流程 ── */
function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`❌ ${e.message}\n`); usage(); process.exit(2); }
  if (opts.help) { usage(); process.exit(0); }
  if (!opts.input) { console.error('❌ 缺少 trip.json 路径\n'); usage(); process.exit(2); }
  if (opts.theme && !THEMES.has(opts.theme)) { console.error(`❌ --theme 只能是 paper/slate/night，当前 ${opts.theme}`); process.exit(2); }
  if (opts.gate !== null && !String(opts.gate).trim()) { console.error('❌ --gate-password 不能为空'); process.exit(2); }

  const input = resolve(opts.input);
  if (!existsSync(input)) { console.error(`❌ 找不到文件：${input}`); process.exit(2); }
  const tripDir = dirname(input);
  let data;
  try { data = JSON.parse(readFileSync(input, 'utf8')); } catch (e) { console.error(`❌ JSON 解析失败：${e.message}`); process.exit(2); }

  // 覆盖参数
  data.meta = data.meta || {};
  if (opts.theme) data.meta.theme = opts.theme;
  const theme = THEMES.has(data.meta.theme) ? data.meta.theme : 'paper';
  if (opts.gate !== null) {
    data.meta.gate = { enabled: true, passwordHash: createHash('sha256').update(String(opts.gate)).digest('hex') };
  }

  // 校验
  const { errors, warnings } = validateTrip(data, { baseDir: tripDir });
  if (errors.length) {
    console.error(`❌ 数据校验未通过（${errors.length} 个错误）：`);
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  warnings.forEach((w) => { if (!opts.quiet) console.warn(`  ⚠️  ${w}`); });

  // 清洗手册 HTML
  (data.handbook || []).forEach((g) => (g.sections || []).forEach((s) => { s.html = sanitizeHtml(s.html); }));

  // 输出目录
  const outDir = resolve(opts.out);
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    if (!opts.force) {
      console.error(`❌ 输出目录非空：${outDir}\n   加 --force 覆盖，或换一个 --out。`);
      process.exit(2);
    }
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const css = readFileSync(join(TEMPLATES, 'style.css'), 'utf8');
  const appJs = readFileSync(join(TEMPLATES, 'app.js'), 'utf8');

  const favicon = makeFavicon(data.meta.title, THEME_META[theme].accent);
  const manifest = manifestFor(data, theme, favicon);
  const manifestJson = JSON.stringify(manifest);
  const manifestDataUri = 'data:application/manifest+json;base64,' + Buffer.from(manifestJson, 'utf8').toString('base64');

  const copied = [];

  // 页面数据
  const pageData = JSON.parse(JSON.stringify(data));
  pageData.mode = opts.multi ? 'multi' : 'single';
  pageData.tickets = (pageData.tickets || []).map((t) => ({ ...t, href: opts.multi ? `ticket-${t.id}.html` : `#ticket-${t.id}` }));

  // 单文件模式：把本地二维码图片内联成 data URI，保证“一个文件就能发”
  if (!opts.multi) {
    const MIME_BY_EXT = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    pageData.tickets = pageData.tickets.map((t) => {
      const qr = String(t.qr || '');
      if (!qr || /^(https?:\/\/|data:)/i.test(qr) || qr.includes('..')) return t;
      const file = resolve(tripDir, qr);
      if (!existsSync(file)) return t;
      const mime = MIME_BY_EXT[extname(file).toLowerCase()] || 'application/octet-stream';
      return { ...t, qr: `data:${mime};base64,${readFileSync(file).toString('base64')}` };
    });
  }

  const indexTpl = readTpl('index.html');
  const baseVars = {
    LANG: escapeAttr(data.meta.lang || 'zh-CN'),
    TITLE: escapeAttr(data.meta.title || '行程'),
    SHORT_TITLE: escapeAttr(String(data.meta.title || '行程').slice(0, 12)),
    DESCRIPTION: escapeAttr(data.meta.subtitle || data.meta.title || '随身行程、清单与手册'),
    THEME_COLOR: THEME_META[theme].bg,
    FAVICON: escapeAttr(favicon),
  };

  const files = [];
  function write(rel, content) {
    const dest = join(outDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, 'utf8');
    files.push({ rel, bytes: Buffer.byteLength(content) });
  }

  if (!opts.multi) {
    // ── 单文件 ──
    const vars = {
      ...baseVars,
      MANIFEST_LINK: opts.noPwa ? '' : `<link rel="manifest" href="${manifestDataUri}">`,
      DATA: jsonForScript(pageData),
    };
    const html = fillTemplate(
      indexTpl
        .replace('<style>{{CSS}}</style>', `<style>${css}</style>`)
        .replace('<script>{{APP_JS}}</script>', `<script>${appJs}</script>`),
      vars
    );
    write('index.html', html);
  } else {
    // ── 多文件 ──
    write('assets/style.css', css);
    write('assets/app.js', appJs);
    if (!opts.noPwa) write('manifest.json', manifestJson);
    const vars = {
      ...baseVars,
      MANIFEST_LINK: opts.noPwa ? '' : '<link rel="manifest" href="manifest.json">',
      DATA: jsonForScript(pageData),
    };
    const html = fillTemplate(
      indexTpl
        .replace('<style>{{CSS}}</style>', '<link rel="stylesheet" href="assets/style.css">')
        .replace('<script>{{APP_JS}}</script>', '<script src="assets/app.js"></script>'),
      vars
    );
    write('index.html', html);

    const ticketTpl = readTpl('ticket.html');
    const siblings = (data.tickets || []).map((t) => ({ id: t.id, person: t.person || '', title: t.title || '票券', href: `ticket-${t.id}.html` }));
    (data.tickets || []).forEach((t) => {
      const tTicket = { ...t, href: `ticket-${t.id}.html` };
      const ticketData = { meta: data.meta, mode: 'ticket', ticket: tTicket, siblings };
      const tvars = {
        LANG: escapeAttr(data.meta.lang || 'zh-CN'),
        TITLE: escapeAttr(`${t.title || '票券'}${t.person ? ' · ' + t.person : ''}`),
        DESCRIPTION: escapeAttr(`${data.meta.title || '行程'} · ${t.title || '票券'}`),
        THEME_COLOR: THEME_META[theme].bg,
        FAVICON: escapeAttr(favicon),
        CSS_BLOCK: '<link rel="stylesheet" href="assets/style.css">',
        JS_BLOCK: '<script src="assets/app.js"></script>',
        DATA: jsonForScript(ticketData),
      };
      write(`ticket-${t.id}.html`, fillTemplate(ticketTpl, tvars));
    });

    collectAssets(data, tripDir, outDir, copied);
    copied.forEach((rel) => {
      const f = join(outDir, rel);
      if (existsSync(f)) files.push({ rel, bytes: statSync(f).size });
    });
  }

  const total = files.reduce((n, f) => n + f.bytes, 0);
  if (!opts.quiet) {
    console.log(`\n✅ TripCheat 已生成（${opts.multi ? '多文件站点' : '单文件页面'}，主题 ${theme}）`);
    console.log(`   输入：${input}`);
    console.log(`   输出：${outDir}`);
    files.forEach((f) => console.log(`   - ${f.rel}  ${describeSize(f.bytes)}`));
    console.log(`   合计 ${files.length} 个文件 / ${describeSize(total)}`);
    if (data.meta.gate && data.meta.gate.enabled) console.log('   🔒 已开启密码门（前端 SHA-256 校验，熟人分享级保护）');
    if (copied.length) console.log(`   🖼️  已复制 ${copied.length} 个票券资源：${copied.join(', ')}`);
    console.log(`\n   本地预览：直接用浏览器打开 ${join(outDir, 'index.html')}`);
    console.log('   或：npx serve dist（或 python -m http.server）');
  }
}

main();
