#!/usr/bin/env node
/* TripCheat · trip.json 校验器
   用法：node scripts/verify.mjs <trip.json> [--strict] [--quiet]
   默认：errors → 退出码 1；warnings 只是提示；--strict 时 warnings 也算失败。 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const KINDS = new Set(['flight', 'move', 'meeting', 'meal', 'visit', 'check', 'free']);
const MODES = new Set(['walking', 'transit', 'driving', 'bicycling']);
const THEMES = new Set(['paper', 'slate', 'night']);
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ALLOWED_TAGS = new Set(['p', 'ul', 'ol', 'li', 'b', 'strong', 'em', 'i', 'a', 'br', 'code', 'mark', 'small', 'span', 'h3', 'h4', 'blockquote']);

function isTz(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !Number.isNaN(d.getTime());
}
function isLink(href) { return typeof href === 'string' && /^(https?:\/\/|mailto:|tel:)/i.test(href); }

function checkHtml(html, label, push) {
  const s = String(html || '');
  if (/<\s*(script|style|iframe|object|embed|form|input|textarea|select|link|meta)\b/i.test(s)) {
    push('error', `${label}: 含不允许的标签（script/style/iframe/form 等）`);
  }
  const tags = [...s.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map((m) => m[1].toLowerCase());
  const bad = [...new Set(tags.filter((t) => !ALLOWED_TAGS.has(t)))];
  if (bad.length) push('warning', `${label}: 含白名单外的标签 ${bad.join(', ')}（build 会移除）`);
  if (/on[a-z]+\s*=/i.test(s)) push('warning', `${label}: 含内联事件属性（build 会移除）`);
  if (/javascript:/i.test(s)) push('error', `${label}: 含 javascript: 链接`);
  // 标签配对检查（避免 <b> 不闭合导致整段排版错乱）
  const stack = [];
  const selfClosing = new Set(['br']);
  for (const m of s.matchAll(/<(\/?)([a-zA-Z0-9]+)[^>]*>/g)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag) || selfClosing.has(tag)) continue;
    if (!closing) stack.push(tag);
    else if (stack.length && stack[stack.length - 1] === tag) stack.pop();
    else push('warning', `${label}: 标签未正确闭合（</${tag}>）`);
  }
  if (stack.length) push('warning', `${label}: 未闭合标签 ${stack.join(', ')}`);
}

export function validateTrip(data, opts = {}) {
  const baseDir = opts.baseDir || process.cwd();
  const errors = [];
  const warnings = [];
  const push = (level, msg) => { (level === 'error' ? errors : warnings).push(msg); };
  const root = data && typeof data === 'object' ? data : {};
  const meta = root.meta || {};

  if (!root.meta) push('error', '缺少 meta');
  if (!meta.title) push('error', 'meta.title 必填');
  if (!meta.home || !meta.home.label) push('error', 'meta.home.label 必填');
  if (!meta.home || !isTz(meta.home.tz)) push('error', `meta.home.tz 无效：${meta.home && meta.home.tz}`);
  if (!isDate(meta.startDate)) push('error', `meta.startDate 无效：${meta.startDate}`);
  if (!isDate(meta.endDate)) push('error', `meta.endDate 无效：${meta.endDate}`);
  if (isDate(meta.startDate) && isDate(meta.endDate) && meta.startDate > meta.endDate) push('error', 'meta.startDate 晚于 meta.endDate');
  if (meta.theme && !THEMES.has(meta.theme)) push('error', `meta.theme 只能是 paper/slate/night，当前 ${meta.theme}`);
  if (meta.mapProvider && !['google', 'amap', 'apple'].includes(meta.mapProvider)) push('error', `meta.mapProvider 无效：${meta.mapProvider}`);
  if (meta.gate && meta.gate.enabled) {
    if (!/^[a-f0-9]{64}$/i.test(String(meta.gate.passwordHash || ''))) push('error', 'meta.gate.passwordHash 必须是 SHA-256 hex（64 位）');
  } else if (meta.gate && meta.gate.passwordHash) {
    push('warning', '设置了 meta.gate.passwordHash 但 enabled 不是 true，密码门不会生效');
  }

  const dests = Array.isArray(root.destinations) ? root.destinations : [];
  if (!dests.length) push('error', 'destinations 必须至少有一项');
  const destIds = new Set();
  dests.forEach((d, i) => {
    if (!d || !d.id) push('error', `destinations[${i}].id 必填`);
    else if (!ID_RE.test(d.id)) push('error', `destinations[${i}].id 只能包含字母数字_-`);
    else if (destIds.has(d.id)) push('error', `destinations id 重复：${d.id}`);
    else destIds.add(d.id);
    if (!d || !d.label) push('error', `destinations[${i}].label 必填`);
    if (!d || !isTz(d.tz)) push('error', `destinations[${i}].tz 无效：${d && d.tz}`);
  });

  const days = Array.isArray(root.days) ? root.days : [];
  if (!days.length) push('error', 'days 必须至少有一天');
  const dayDates = new Set();
  const allCheckIds = new Set();
  (Array.isArray(root.checklists) ? root.checklists : []).forEach((g, gi) => {
    if (!g || !g.id) push('error', `checklists[${gi}].id 必填`);
    (g && Array.isArray(g.items) ? g.items : []).forEach((it, ii) => {
      if (!it || !it.id) push('error', `checklists[${gi}].items[${ii}].id 必填`);
      else if (allCheckIds.has(it.id)) push('error', `清单 id 重复：${it.id}`);
      else allCheckIds.add(it.id);
      if (!it || !it.title) push('error', `checklists[${gi}].items[${ii}].title 必填`);
      (it && it.links ? it.links : []).forEach((l, li) => { if (!isLink(l && l.href)) push('error', `清单链接不合法：checklists[${gi}].items[${ii}].links[${li}]`); });
    });
  });

  days.forEach((d, di) => {
    if (!d || !isDate(d.date)) push('error', `days[${di}].date 无效：${d && d.date}`);
    if (d && d.date && isDate(meta.startDate) && isDate(meta.endDate) && (d.date < meta.startDate || d.date > meta.endDate)) {
      push('warning', `days[${di}].date ${d.date} 不在 startDate~endDate 之间`);
    }
    if (d && d.date && dayDates.has(d.date)) push('warning', `days 日期重复：${d.date}`);
    if (d && d.date) dayDates.add(d.date);
    if (!d || !d.destination) push('error', `days[${di}].destination 必填`);
    else if (!destIds.has(d.destination)) push('error', `days[${di}].destination 引用不存在的目的地：${d.destination}`);
    const dest = dests.find((x) => x && x.id === d.destination);
    const dayTz = dest && dest.tz;
    const events = Array.isArray(d && d.events) ? d.events : [];
    if (!events.length) push('warning', `days[${di}]（${d && d.date}）没有事件`);
    const starts = new Set();
    events.forEach((ev, ei) => {
      const at = `days[${di}].events[${ei}]`;
      if (!ev || !ev.title) push('error', `${at}.title 必填`);
      if (!ev || !TIME_RE.test(String(ev.time || ''))) push('error', `${at}.time 必须是 HH:MM`);
      if (ev && ev.endTime && !TIME_RE.test(String(ev.endTime))) push('error', `${at}.endTime 必须是 HH:MM`);
      if (ev && ev.tz && !isTz(ev.tz)) push('error', `${at}.tz 无效：${ev.tz}`);
      if (ev && !ev.tz && !dayTz) push('error', `${at} 缺少时区（day.destination 无效时需显式 event.tz）`);
      if (ev && ev.kind && !KINDS.has(ev.kind)) push('warning', `${at}.kind 建议用 flight/move/meeting/meal/visit/check/free，当前 ${ev.kind}`);
      if (ev && ev.links) ev.links.forEach((l, li) => { if (!isLink(l && l.href)) push('error', `${at}.links[${li}].href 不合法`); });
      if (ev && ev.map && ev.map.mode && !MODES.has(ev.map.mode)) push('error', `${at}.map.mode 无效：${ev.map.mode}`);
      if (ev && ev.checkId && !allCheckIds.has(ev.checkId)) push('warning', `${at}.checkId 未匹配任何清单项：${ev.checkId}`);
      if (ev && ev.time) {
        if (starts.has(ev.time)) push('warning', `${at} 与其他事件时间重复：${ev.time}`);
        starts.add(ev.time);
      }
      // 双时区可计算性
      if (ev && TIME_RE.test(String(ev.time || ''))) {
        const tz = (ev && ev.tz) || dayTz;
        if (isTz(tz)) {
          try {
            const [hh, mm] = String(ev.time).split(':').map(Number);
            const [Y, M, D] = String(d.date).split('-').map(Number);
            const guess = Date.UTC(Y, M - 1, D, hh, mm, 0);
            new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23' }).format(new Date(guess));
            new Intl.DateTimeFormat('en-CA', { timeZone: isTz(meta.home && meta.home.tz) ? meta.home.tz : 'UTC' }).format(new Date(guess));
          } catch {
            push('error', `${at} 双时区换算失败`);
          }
        }
      }
    });
  });

  const handbook = Array.isArray(root.handbook) ? root.handbook : [];
  const hbIds = new Set();
  handbook.forEach((g, gi) => {
    if (!g || !g.id) push('error', `handbook[${gi}].id 必填`);
    else if (hbIds.has(g.id)) push('error', `handbook id 重复：${g.id}`);
    else hbIds.add(g.id);
    if (!g || !g.title) push('error', `handbook[${gi}].title 必填`);
    (g && Array.isArray(g.sections) ? g.sections : []).forEach((s, si) => {
      if (!s || !s.id) push('error', `handbook[${gi}].sections[${si}].id 必填`);
      if (!s || !s.title) push('error', `handbook[${gi}].sections[${si}].title 必填`);
      checkHtml(s && s.html, `handbook[${gi}].sections[${si}]`, push);
      (s && s.copy ? s.copy : []).forEach((c, ci) => {
        if (!c || typeof c !== 'object' || typeof c.value !== 'string' || !c.value) push('error', `handbook[${gi}].sections[${si}].copy[${ci}] 需要 { label, value }`);
      });
    });
  });

  const tickets = Array.isArray(root.tickets) ? root.tickets : [];
  const tIds = new Set();
  tickets.forEach((t, ti) => {
    if (!t || !t.id || !ID_RE.test(t.id)) push('error', `tickets[${ti}].id 必须是字母数字_-`);
    else if (tIds.has(t.id)) push('error', `tickets id 重复：${t.id}`);
    else tIds.add(t.id);
    if (!t || !t.title) push('error', `tickets[${ti}].title 必填`);
    if (t && t.qr) {
      const qr = String(t.qr);
      if (!/^(https?:\/\/|data:)/i.test(qr)) {
        const file = isAbsolute(qr) ? qr : resolve(baseDir, qr);
        if (!existsSync(file)) push('error', `tickets[${ti}].qr 文件不存在：${qr}（相对 trip.json 所在目录解析）`);
      }
    } else push('warning', `tickets[${ti}] 没有 qr 字段`);
    (t && t.links ? t.links : []).forEach((l, li) => { if (!isLink(l && l.href)) push('error', `tickets[${ti}].links[${li}].href 不合法`); });
  });

  // 隐私扫描（警告级）：明显像手机号/身份证/订单号的字符串
  const flat = JSON.stringify(root);
  if (/1[3-9]\d{9}/.test(flat)) push('warning', '数据里出现疑似中国大陆手机号，发布前请脱敏');
  if (/\b\d{15}|\b\d{18}\b/.test(flat)) push('warning', '数据里出现疑似身份证/长数字编号，发布前请脱敏');

  return { errors, warnings };
}

/* ── CLI ── */
async function cli() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const quiet = argv.includes('--quiet');
  const file = argv.filter((a) => !a.startsWith('--'))[0];
  if (!file) {
    console.error('用法：node scripts/verify.mjs <trip.json> [--strict] [--quiet]');
    process.exit(2);
  }
  const abs = resolve(file);
  if (!existsSync(abs)) { console.error(`找不到文件：${abs}`); process.exit(2); }
  let data;
  try { data = JSON.parse(readFileSync(abs, 'utf8')); } catch (e) { console.error(`JSON 解析失败：${e.message}`); process.exit(2); }
  const { errors, warnings } = validateTrip(data, { baseDir: dirname(abs) });
  if (!quiet) {
    console.log(`TripCheat verify: ${abs}`);
    warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  }
  errors.forEach((e) => console.log(`  ❌  ${e}`));
  const ok = errors.length === 0 && (!strict || warnings.length === 0);
  console.log(`\n${ok ? '✅ 通过' : '❌ 未通过'}：${errors.length} 个错误、${warnings.length} 个警告${strict ? '（strict 模式）' : ''}`);
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) cli();
