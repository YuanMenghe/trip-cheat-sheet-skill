/* TripCheat · 随身行程页前端逻辑（无依赖，直接内联或用 <script src> 引入）
   页面数据来自 <script type="application/json" id="trip-data">（主页面）
   或多文件模式的票券页 <script type="application/json" id="trip-ticket">。 */
(function () {
  'use strict';

  /* ───────────────────────── 工具 ───────────────────────── */
  var DAY_MS = 86400000;
  var FONTS = ['sm', 'md', 'lg', 'xl'];
  var FONT_LABEL = { sm: '小', md: '标准', lg: '大', xl: '特大' };
  var THEMES = ['paper', 'slate', 'night'];
  var THEME_LABEL = { paper: '暖纸', slate: '冷灰', night: '夜间' };
  var KIND_LABEL = { flight: '航班', move: '交通', meeting: '会议', meal: '餐饮', visit: '游览', check: '办理', free: '自由' };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function parsesJson(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (e) { return null; }
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    if (kids == null) kids = [];
    else if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (kid) {
      if (kid == null || kid === false) return;
      n.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    });
    return n;
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'trip'; }
  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDateCN(dateStr) {
    var p = String(dateStr).split('-');
    return p.length === 3 ? Number(p[1]) + '月' + Number(p[2]) + '日' : dateStr;
  }
  function weekday(dateStr) {
    var t = new Date(dateStr + 'T12:00:00Z');
    return '日一二三四五六'.charAt(t.getUTCDay()) === '' ? '' : '周' + '日一二三四五六'.charAt(t.getUTCDay());
  }
  function parseHM(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? { h: +m[1], m: +m[2] } : null; }

  /* ───────────────────── 时区（与运行环境时区无关）───────────────────── */
  function tzParts(utcMs, tz) {
    var f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var out = {};
    f.formatToParts(new Date(utcMs)).forEach(function (p) { if (p.type !== 'literal') out[p.type] = p.value; });
    if (out.hour === '24') out.hour = '00';
    return out;
  }
  function offsetAt(tz, utcMs) {
    var p = tzParts(utcMs, tz);
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  }
  function wallToUtc(dateStr, hm, tz) {
    var dp = String(dateStr).split('-').map(Number);
    var guess = Date.UTC(dp[0], dp[1] - 1, dp[2], hm.h, hm.m, 0);
    var off = offsetAt(tz, guess);
    return guess - off;
  }
  function fmtInTz(utcMs, tz, withDate) {
    var p = tzParts(utcMs, tz);
    var s = p.hour + ':' + p.minute;
    return withDate ? (Number(p.month) + '/' + Number(p.day) + ' ' + s) : s;
  }
  function tzLabel(tz) { return String(tz || '').split('/').pop().replace(/_/g, ' '); }
  function sameLocalDay(utcMs, tz) {
    var a = tzParts(utcMs, tz), b = tzParts(NOW, tz);
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  /* ───────────────────── 数据结构化 ───────────────────── */
  function buildModel(data) {
    var meta = data.meta || {};
    var home = meta.home || { label: '北京', tz: 'Asia/Shanghai' };
    var destMap = {};
    (data.destinations || []).forEach(function (d) { destMap[d.id] = d; });
    var baseTz = home.tz;
    var days = (data.days || []).map(function (d, di) {
      var dest = destMap[d.destination] || (data.destinations && data.destinations[0]) || { id: 'x', label: '目的地', tz: baseTz };
      var dayTz = dest.tz || baseTz;
      var events = (d.events || []).map(function (ev, ei) {
        var tz = ev.tz || dayTz;
        var hm = parseHM(ev.time) || { h: 0, m: 0 };
        var start = wallToUtc(d.date, hm, tz);
        var end = null;
        if (ev.endTime) {
          var ehm = parseHM(ev.endTime);
          if (ehm) {
            end = wallToUtc(d.date, ehm, tz);
            if (end <= start) end += DAY_MS;
          }
        }
        return {
          id: 'ev-' + di + '-' + ei,
          dayIndex: di,
          date: d.date,
          tz: tz,
          tzLabel: tzLabel(tz),
          start: start,
          end: end,
          hm: hm,
          title: ev.title || '',
          short: ev.short || ev.title || '',
          detail: ev.detail || '',
          kind: ev.kind || 'meeting',
          location: ev.location || '',
          map: ev.map || null,
          links: ev.links || [],
          checkId: ev.checkId || null,
          skipTimezone: !!ev.skipTimezone
        };
      });
      return {
        index: di,
        date: d.date,
        destination: dest,
        tz: dayTz,
        title: d.title || fmtDateCN(d.date),
        note: d.note || '',
        events: events
      };
    });
    var allEvents = [];
    days.forEach(function (d) { d.events.forEach(function (e) { allEvents.push(e); }); });
    allEvents.sort(function (a, b) { return a.start - b.start; });
    return { meta: meta, home: home, destinations: data.destinations || [], days: days, allEvents: allEvents, raw: data };
  }

  /* ───────────────────── 状态存储 ───────────────────── */
  function makeStore(model) {
    var prefix = 'tripcheat:' + hashStr(model.meta.title || 'trip') + ':';
    var mem = {};
    function get(k, dflt) {
      try { var v = localStorage.getItem(prefix + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; }
    }
    function set(k, v) { try { localStorage.setItem(prefix + k, JSON.stringify(v)); } catch (e) { mem[k] = v; } }
    return { get: get, set: set, remove: function (k) { try { localStorage.removeItem(prefix + k); } catch (e) {} } };
  }

  /* ───────────────────── 主题 / 字号 ───────────────────── */
  function initLook(model, store) {
    var root = document.documentElement;
    var theme = store.get('theme', null);
    if (THEMES.indexOf(theme) < 0) {
      theme = model.meta.theme && THEMES.indexOf(model.meta.theme) >= 0 ? model.meta.theme
        : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper');
    }
    applyTheme(theme);
    var font = store.get('font', 'md');
    if (FONTS.indexOf(font) < 0) font = 'md';
    root.setAttribute('data-font', font);

    function applyTheme(t) {
      root.setAttribute('data-theme', t);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'night' ? '#0f1115' : t === 'slate' ? '#eef2f7' : '#efe6d6');
      var btn = document.getElementById('theme-btn');
      if (btn) { btn.textContent = '主题·' + THEME_LABEL[t]; btn.setAttribute('aria-label', '切换颜色主题，当前' + THEME_LABEL[t]); }
    }
    function cycleTheme() {
      var cur = root.getAttribute('data-theme');
      var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      applyTheme(next); store.set('theme', next);
    }
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-action="theme"]') : null;
      if (t) cycleTheme();
    });
    var themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', cycleTheme);
    var fontBtn = document.getElementById('font-btn');
    function paintFont() {
      if (fontBtn) { fontBtn.textContent = '字·' + FONT_LABEL[root.getAttribute('data-font') || 'md']; }
    }
    paintFont();
    if (fontBtn) fontBtn.addEventListener('click', function () {
      var cur = root.getAttribute('data-font') || 'md';
      var next = FONTS[(FONTS.indexOf(cur) + 1) % FONTS.length];
      root.setAttribute('data-font', next); store.set('font', next); paintFont();
    });
    return { cycleTheme: cycleTheme };
  }

  /* ───────────────────── 提示 / 复制 ───────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.hidden = true; }, 220); }, 1600);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }).catch(function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请手动选择'); }
      ta.remove();
    }
  }

  /* ───────────────────── 地图 / 链接 ───────────────────── */
  function mapLink(meta, map) {
    var q = map && (map.query || map.address) || '';
    if (!q) return null;
    var mode = (map && map.mode) || 'transit';
    var provider = meta.mapProvider || 'google';
    if (provider === 'amap') return 'https://uri.amap.com/search?keyword=' + encodeURIComponent(q);
    if (provider === 'apple') return 'https://maps.apple.com/?q=' + encodeURIComponent(q);
    if (mode === 'search') return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }
  function mapDirections(meta, ev) {
    if (!ev.map || !ev.map.query) return null;
    var mode = ev.map.mode || 'transit';
    var provider = meta.mapProvider || 'google';
    if (provider === 'google') {
      return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.map.query) +
        (mode === 'transit' ? '' : '&travelmode=' + encodeURIComponent(mode));
    }
    return mapLink(meta, ev.map);
  }

  /* ───────────────────── 时间显示 ───────────────────── */
  var NOW = Date.now();
  function updateNow() { NOW = Date.now(); }

  function activeDestination(model) {
    var now = NOW;
    for (var i = 0; i < model.days.length; i++) {
      var d = model.days[i];
      if (!d.events.length) continue;
      var first = d.events[0], last = d.events[d.events.length - 1];
      var endTs = last.end || last.start;
      if (now >= first.start && now <= endTs + 3 * 3600000) return d.destination;
    }
    var next = model.allEvents.filter(function (e) { return e.start > now; })[0];
    if (next) {
      var nd = model.days[next.dayIndex];
      return nd ? nd.destination : null;
    }
    return model.days.length ? model.days[model.days.length - 1].destination : null;
  }

  function nextInfo(model) {
    var now = NOW;
    var current = null, next = null;
    for (var i = 0; i < model.allEvents.length; i++) {
      var e = model.allEvents[i];
      if (e.end && now >= e.start && now <= e.end) { current = e; break; }
      if (now < e.start) { next = e; break; }
    }
    if (current) return { kind: 'current', ev: current };
    if (next) return { kind: 'next', ev: next };
    var last = model.allEvents[model.allEvents.length - 1];
    return last ? { kind: 'after', ev: last } : { kind: 'empty', ev: null };
  }

  function relTime(ts) {
    var diff = ts - NOW;
    var abs = Math.abs(diff);
    var mins = Math.round(abs / 60000);
    var str;
    if (mins < 1) str = '不到 1 分钟';
    else if (mins < 60) str = mins + ' 分钟';
    else if (mins < 60 * 24) str = Math.floor(mins / 60) + ' 小时 ' + (mins % 60 ? (mins % 60) + ' 分' : '');
    else str = Math.floor(mins / 1440) + ' 天 ' + (Math.floor(mins % 1440 / 60)) + ' 小时';
    return diff >= 0 ? '还有 ' + str : '已过 ' + str;
  }

  /* ───────────────────── 顶部：时钟 / 接下来 ───────────────────── */
  function renderTop(model, refs) {
    var clocks = document.getElementById('clocks');
    var active = activeDestination(model);
    function paintClocks() {
      if (!clocks) return;
      clocks.textContent = '';
      var home = model.home;
      var now = new Date();
      var homeP = tzParts(now.getTime(), home.tz);
      clocks.appendChild(el('span', { class: 'clock is-home' }, [
        home.label || tzLabel(home.tz), ' ',
        el('b', null, now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', timeZone: home.tz }) + ' ' + homeP.hour + ':' + homeP.minute)
      ]));
      if (active) {
        var nowMs = now.getTime();
        var sameOffset = offsetAt(active.tz, nowMs) === offsetAt(home.tz, nowMs);
        if (sameOffset) {
          clocks.appendChild(el('span', { class: 'clock same-tz', title: '目的地与常驻地时区相同，无需换算' }, ['同时区：' + (active.label || tzLabel(active.tz)) + ' 与 ' + (home.label || tzLabel(home.tz))]));
        } else {
          var ap = tzParts(nowMs, active.tz);
          clocks.appendChild(el('span', { class: 'clock' }, [
            active.label || tzLabel(active.tz), ' ',
            el('b', null, now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', timeZone: active.tz }) + ' ' + ap.hour + ':' + ap.minute)
          ]));
        }
      }
    }
    paintClocks();
    setInterval(paintClocks, 1000);

    var nextbar = document.getElementById('nextbar');
    function paintNext() {
      if (!nextbar) return;
      nextbar.textContent = '';
      updateNow();
      var info = nextInfo(model);
      if (info.kind === 'empty') { nextbar.hidden = true; return; }
      var ev = info.ev;
      var label;
      if (info.kind === 'current') label = el('span', null, ['进行中：', el('b', null, ev.short), ' ', el('span', { class: 'when' }, '至 ' + (ev.end ? fmtInTz(ev.end, ev.tz) : ''))]);
      else if (info.kind === 'next') label = el('span', null, ['接下来：', el('b', null, ev.short), ' ', el('span', { class: 'when' }, relTime(ev.start) + ' · ' + (sameLocalDay(ev.start, ev.tz) ? fmtInTz(ev.start, ev.tz) : fmtInTz(ev.start, ev.tz, true)))]);
      else label = el('span', null, ['已完成全部日程']);
      var btn = el('button', { type: 'button', 'data-action': 'jump-next' }, [label]);
      btn.addEventListener('click', function () {
        refs.setView('itinerary');
        var day = ev.dayIndex;
        refs.selectDay(day);
        setTimeout(function () { scrollToEvent(ev.id); }, 30);
      });
      nextbar.appendChild(btn);
      var todayBtn = el('button', { type: 'button', class: 'back-today', 'data-action': 'jump-today' }, ['今天']);
      todayBtn.addEventListener('click', function () { refs.setView('itinerary'); refs.selectDay(refs.todayIndex()); });
      nextbar.appendChild(todayBtn);
    }
    paintNext();
    setInterval(paintNext, 20000);
    return { paintNext: paintNext };
  }

  function scrollToEvent(id) {
    var node = document.getElementById(id);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ───────────────────── 主页面 ───────────────────── */
  function initMain(data) {
    var model = buildModel(data);
    var store = makeStore(model);
    initLook(model, store);

    var state = {
      view: store.get('view', 'itinerary'),
      day: null,
      filter: store.get('filter', 'open'),
      search: '',
      ticket: null
    };
    if (!['itinerary', 'checklist', 'handbook'].includes(state.view)) state.view = 'itinerary';

    function todayIndex() {
      var now = NOW;
      for (var i = 0; i < model.days.length; i++) {
        var d = model.days[i];
        if (!d.events.length) continue;
        var first = d.events[0].start, last = d.events[d.events.length - 1];
        var end = last.end || last.start;
        if (now >= first.start && now <= end + 6 * 3600000) return i;
      }
      for (var j = 0; j < model.days.length; j++) if (model.days[j].events.length && model.days[j].events[0].start > now) return j;
      return model.days.length - 1;
    }
    function selectDay(i) {
      if (i < 0 || i >= model.days.length) return;
      state.day = i;
      if (state.view === 'itinerary') renderItinerary();
      paintDaybar();
    }
    function setView(v) {
      state.view = v;
      store.set('view', v);
      paintTabs();
      renderView();
    }

    // 顶部
    var titleEl = document.querySelector('#top h1');
    if (titleEl) titleEl.textContent = model.meta.title || '行程';
    // 行程性质徽章（公差 / 私差 / 混合）
    var typeLabels = { business: '公差', leisure: '私差', mixed: '混合' };
    var typeLabel = typeLabels[model.meta.tripType];
    if (typeLabel) {
      var titleRow = document.querySelector('#top .title-row');
      if (titleRow && titleEl) {
        titleRow.insertBefore(
          el('span', { class: 'trip-type', title: '行程性质：' + typeLabel }, typeLabel),
          titleEl.nextSibling
        );
      }
    }
    var refs = { setView: setView, selectDay: selectDay, todayIndex: todayIndex };
    renderTop(model, refs);

    // Tab 栏
    function paintTabs() {
      var tabs = document.getElementById('tabbar-inner');
      if (!tabs) return;
      tabs.textContent = '';
      var remain = remainingCount();
      [
        { id: 'itinerary', label: '行程', icon: iconCalendar() },
        { id: 'checklist', label: '清单', icon: iconCheck(), badge: remain },
        { id: 'handbook', label: '手册', icon: iconBook() }
      ].forEach(function (t) {
        var b = el('button', { type: 'button', 'aria-current': state.view === t.id ? 'page' : null }, [t.icon, t.label]);
        if (t.badge) b.appendChild(el('span', { class: 'badge' }, String(t.badge)));
        b.addEventListener('click', function () { setView(t.id); window.scrollTo({ top: 0 }); });
        tabs.appendChild(b);
      });
    }

    // 清单状态
    var checks = {};
    (store.get('checks', []) || []).forEach(function (id) { checks[id] = true; });
    function allItems() {
      var out = [];
      (data.checklists || []).forEach(function (g) {
        (g.items || []).forEach(function (it) { out.push({ group: g, item: it }); });
      });
      return out;
    }
    function remainingCount() { return allItems().filter(function (x) { return !checks[x.item.id]; }).length; }
    function saveChecks() { store.set('checks', Object.keys(checks).filter(function (k) { return checks[k]; })); paintTabs(); }

    // ── 行程视图
    function paintDaybar() {
      var bar = document.getElementById('daybar');
      if (!bar) return;
      bar.textContent = '';
      model.days.forEach(function (d, i) {
        var b = el('button', { type: 'button', 'aria-current': String(state.day === i) }, [
          el('b', null, fmtDateCN(d.date).replace('月', '/').replace('日', '')),
          weekday(d.date)
        ]);
        if (d.date === todayISO()) b.classList.add('has-today');
        b.addEventListener('click', function () { selectDay(i); });
        bar.appendChild(b);
      });
    }
    function todayISO() {
      var p = tzParts(NOW, model.home.tz);
      return p.year + '-' + p.month + '-' + p.day;
    }
    function eventNode(ev, info) {
      var node = el('li', { class: 'ev', id: ev.id, 'data-kind': ev.kind });
      if (ev.start < NOW) node.classList.add('is-past');
      if (info && info.kind === 'next' && info.ev.id === ev.id) node.classList.add('is-next');
      if (info && info.kind === 'current' && info.ev.id === ev.id) node.classList.add('is-next');
      var sameTzAsHome = offsetAt(ev.tz, ev.start) === offsetAt(model.home.tz, ev.start);
      var showHome = !ev.skipTimezone && model.meta.showTimezone !== false && !sameTzAsHome;
      var time = el('div', { class: 'time' }, [el('b', null, fmtInTz(ev.start, ev.tz))]);
      if (showHome) {
        time.appendChild(el('span', { class: 'home' }, (model.home.label || tzLabel(model.home.tz) || '常驻地') + ' ' + fmtInTz(ev.start, model.home.tz)));
      }
      var card = el('div', { class: 'card' });
      var head = el('div', { class: 'head' }, [el('h3', null, ev.title)]);
      if (ev.kind && KIND_LABEL[ev.kind]) head.appendChild(el('span', { class: 'tag' }, KIND_LABEL[ev.kind]));
      card.appendChild(head);
      if (ev.location) card.appendChild(el('div', { class: 'loc' }, '📍 ' + ev.location));
      var actions = el('div', { class: 'actions' });
      var m = mapDirections(model.meta, ev);
      if (m) actions.appendChild(el('a', { class: 'map', href: m, target: '_blank', rel: 'noopener' }, '地图'));
      (ev.links || []).forEach(function (l) {
        if (!l || !l.href) return;
        actions.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener' }, l.label || '链接'));
      });
      if (ev.checkId && (data.checklists || []).some(function (g) { return (g.items || []).some(function (it) { return it.id === ev.checkId; }); })) {
        actions.appendChild(el('button', { type: 'button', onclick: function () { toggleCheck(ev.checkId); } }, checks[ev.checkId] ? '✓ 清单已勾' : '勾选清单项'));
      }
      card.appendChild(actions);
      if (ev.detail) {
        var d = el('details', null, [el('summary', null, '详情'), el('div', { class: 'detail' }, ev.detail)]);
        card.appendChild(d);
      }
      var dot = el('span', { class: 'dot' });
      node.appendChild(time); node.appendChild(dot); node.appendChild(card);
      return node;
    }
    function renderItinerary() {
      var main = document.getElementById('main');
      main.textContent = '';
      if (!model.days.length) { main.appendChild(el('p', { class: 'empty' }, '还没有行程数据。')); return; }
      if (state.day == null) state.day = todayIndex();
      if (state.day >= model.days.length) state.day = model.days.length - 1;
      main.appendChild(el('div', { class: 'daybar', id: 'daybar', role: 'tablist', 'aria-label': '选择日期' }));
      paintDaybar();
      var d = model.days[state.day];
      var info = nextInfo(model);
      // 出发前 / 结束后提示
      var firstEv = model.allEvents[0], lastEv = model.allEvents[model.allEvents.length - 1];
      if (firstEv && NOW < firstEv.start) {
        var before = el('div', { class: 'note-before' }, [el('p', null, '还没出发：距第一件事还有 ' + relTime(firstEv.start).replace('还有 ', '') + '。清单里的准备项记得勾。')]);
        main.appendChild(before);
      }
      if (lastEv && (!lastEv.end || NOW > (lastEv.end || lastEv.start))) {
        main.appendChild(el('div', { class: 'note-after ok' }, [el('p', null, '按计划已经结束全部日程，页面仍可查看。')]));
      }
      var head = el('div', { class: 'day-title' }, [
        el('h2', null, d.title),
        el('span', { class: 'meta' }, fmtDateCN(d.date) + ' · ' + weekday(d.date) + ' · ' + (d.destination.label || tzLabel(d.tz)))
      ]);
      main.appendChild(head);
      if (d.note) main.appendChild(el('div', { class: 'day-note' }, [el('p', null, d.note)]));
      var ul = el('ul', { class: 'timeline' });
      d.events.forEach(function (ev) { ul.appendChild(eventNode(ev, info)); });
      main.appendChild(ul);
      // 票券入口
      var tickets = data.tickets || [];
      if (tickets.length) {
        var box = el('div', { class: 'ticket-tabs' });
        tickets.forEach(function (t) {
          box.appendChild(el('button', {
            type: 'button',
            onclick: function () { openTicket(t.id); }
          }, '🎫 ' + (t.title || '票券') + (t.person ? ' · ' + t.person : '')));
        });
        main.appendChild(box);
      }
      main.appendChild(footerNode());
      // 自动滚到"接下来"：只在 3 天内才滚，远期行程保留顶部上下文（日期条/出发提示）
      if (info.ev && info.ev.dayIndex === state.day && info.ev.start - NOW < 3 * 86400000) {
        setTimeout(function () { scrollToEvent(info.ev.id); }, 60);
      }
    }

    // ── 清单视图
    function toggleCheck(id) {
      checks[id] = !checks[id];
      if (!checks[id]) delete checks[id];
      saveChecks();
      if (state.view === 'checklist') renderChecklist();
      else if (state.view === 'itinerary') renderItinerary();
    }
    function renderChecklist() {
      var main = document.getElementById('main');
      main.textContent = '';
      var items = allItems();
      var done = items.filter(function (x) { return checks[x.item.id]; }).length;
      var pct = items.length ? Math.round(done / items.length * 100) : 0;
      main.appendChild(el('div', { class: 'progress-wrap' }, [
        el('div', { class: 'progress-top' }, [el('span', null, '完成 ' + done + ' / ' + items.length), el('span', null, pct + ' %')]),
        el('div', { class: 'progress' }, [el('span', { style: 'width:' + pct + '%' })])
      ]));
      var filters = el('div', { class: 'filters', role: 'group', 'aria-label': '筛选清单' });
      [['open', '未完成'], ['done', '已完成'], ['all', '全部']].forEach(function (f) {
        filters.appendChild(el('button', { type: 'button', 'aria-pressed': String(state.filter === f[0]), onclick: function () { state.filter = f[0]; store.set('filter', f[0]); renderChecklist(); } }, f[1]));
      });
      main.appendChild(filters);

      var visible = items.filter(function (x) {
        if (state.filter === 'open') return !checks[x.item.id];
        if (state.filter === 'done') return !!checks[x.item.id];
        return true;
      });
      if (!visible.length) { main.appendChild(el('p', { class: 'empty' }, '这个筛选下没有事项。')); }
      var groups = [];
      visible.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
      groups.forEach(function (g) {
        var box = el('section', { class: 'group' }, [el('h2', null, g.title || '清单')]);
        visible.filter(function (x) { return x.group === g; }).forEach(function (x) {
          var it = x.item;
          var row = el('button', { type: 'button', class: 'row', 'aria-pressed': String(!!checks[it.id]) }, [
            el('span', { class: 'box' }),
            el('span', null, [el('span', { class: 't' }, it.title), it.detail ? el('span', { class: 'd' }, it.detail) : null])
          ]);
          row.addEventListener('click', function () { toggleCheck(it.id); });
          var item = el('div', { class: 'item' }, [row]);
          var links = el('div', { class: 'links' });
          if (it.copy) links.appendChild(el('button', { type: 'button', class: 'copy', onclick: function (e) { e.stopPropagation(); copyText(it.copy); } }, '复制：' + (String(it.copy).length > 18 ? String(it.copy).slice(0, 18) + '…' : it.copy)));
          (it.links || []).forEach(function (l) { if (l && l.href) links.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener' }, l.label || '链接')); });
          if (links.children.length) item.appendChild(links);
          box.appendChild(item);
        });
        main.appendChild(box);
      });
      main.appendChild(footerNode());
    }

    // ── 手册视图
    function renderHandbook() {
      var main = document.getElementById('main');
      main.textContent = '';
      var input = el('input', { class: 'search', type: 'search', placeholder: '搜索手册，例如：机场交通、支付、Wi-Fi', 'aria-label': '搜索手册' });
      input.value = state.search || '';
      input.addEventListener('input', function () { state.search = input.value; applySearch(); });
      main.appendChild(input);
      (data.handbook || []).forEach(function (g) {
        var sec = el('details', { class: 'sec' }, []);
        var sum = el('summary', null, [el('h2', null, g.title || '')]);
        var count = (g.sections || []).length;
        if (count) sum.appendChild(el('span', { class: 'count' }, count + ' 节'));
        sec.appendChild(sum);
        var body = el('div', { class: 'body' });
        (g.sections || []).forEach(function (s) {
          var wrap = el('div', { class: 'hb-sec', 'data-text': (s.title || '') + ' ' + stripTags(s.html || '') });
          wrap.appendChild(el('h3', null, s.title || ''));
          var html = el('div', { class: 'hb-html' });
          html.innerHTML = s.html || '';
          wrap.appendChild(html);
          (s.copy || []).forEach(function (c) {
            var row = el('div', { class: 'copy-row' }, [el('button', { type: 'button', onclick: function () { copyText(c.value || c); } }, '复制：' + (c.label || '内容'))]);
            wrap.appendChild(row);
          });
          body.appendChild(wrap);
        });
        sec.appendChild(body);
        main.appendChild(sec);
      });
      main.appendChild(footerNode());
      applySearch();
      function applySearch() {
        var q = (state.search || '').trim().toLowerCase();
        var found = 0;
        (main.querySelectorAll('details.sec') || []).forEach(function (sec) {
          var secs = Array.prototype.slice.call(sec.querySelectorAll('.hb-sec'));
          var any = false;
          secs.forEach(function (s) {
            var text = (s.getAttribute('data-text') || '').toLowerCase();
            var ok = !q || text.indexOf(q) >= 0;
            s.hidden = !ok;
            if (ok) { any = true; found++; }
          });
          sec.hidden = !any;
          if (q && any) sec.open = true;
        });
        var old = main.querySelector('.search-empty');
        if (old) old.remove();
        if (q && !found) main.appendChild(el('p', { class: 'empty search-empty' }, '没有匹配的章节，换个关键词试试。'));
      }
    }
    function stripTags(s) { var d = document.createElement('div'); d.innerHTML = s; return d.textContent || ''; }

    function footerNode() {
      if (!model.meta.footer) return el('p', { class: 'foot' });
      return el('p', { class: 'foot' }, model.meta.footer);
    }

    // ── 票券（单文件：页内打开）
    function openTicket(id) {
      var t = (data.tickets || []).filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      if (data.mode === 'multi') { location.href = t.href || ('ticket-' + id + '.html'); return; }
      location.hash = '#ticket-' + id;
    }
    function renderTicketView(id) {
      var t = (data.tickets || []).filter(function (x) { return x.id === id; })[0];
      if (!t) return false;
      var main = document.getElementById('main');
      main.textContent = '';
      var wrap = el('div', { class: 'ticket-wrap' });
      var tabs = el('div', { class: 'ticket-tabs' });
      (data.tickets || []).forEach(function (x) {
        tabs.appendChild(el('button', { type: 'button', 'aria-pressed': String(x.id === id), onclick: function () { location.hash = '#ticket-' + x.id; } }, (x.person || '') + ' · ' + (x.title || '票券')));
      });
      wrap.appendChild(tabs);
      var card = el('div', { class: 'ticket-card' }, [
        el('h2', null, t.title || '票券'),
        t.person ? el('p', { class: 'person' }, '持有人：' + t.person) : null,
        el('img', { src: t.qr || '', alt: (t.person || '') + ' 的二维码' }),
        t.hint ? el('p', { class: 'hint' }, t.hint) : null
      ]);
      (t.links || []).forEach(function (l) { if (l && l.href) card.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener', class: 'ticket-back' }, l.label || '链接')); });
      card.appendChild(el('a', { class: 'ticket-back', href: '#', onclick: function (e) { e.preventDefault(); location.hash = ''; } }, '返回行程'));
      wrap.appendChild(card);
      main.appendChild(wrap);
      paintTabs();
      return true;
    }

    function renderView() {
      if (state.ticket) { if (renderTicketView(state.ticket)) return; state.ticket = null; }
      if (state.view === 'itinerary') renderItinerary();
      else if (state.view === 'checklist') renderChecklist();
      else renderHandbook();
    }

    // hash 路由：单文件模式的票券
    function routeHash() {
      var h = location.hash || '';
      var m = /^#ticket-(.+)$/.exec(h);
      if (m) {
        state.ticket = decodeURIComponent(m[1]);
        renderTicketView(state.ticket);
      } else if (state.ticket) {
        state.ticket = null;
        renderView();
      }
    }
    window.addEventListener('hashchange', routeHash);

    // 启动
    state.day = store.get('day', null);
    if (state.day == null || state.day < 0 || state.day >= model.days.length) state.day = todayIndex();
    paintTabs();
    routeHash();
    if (!state.ticket) renderView();
    window.addEventListener('scroll', function () { /* noop，占位保证移动端滚动稳定 */ }, { passive: true });
  }

  /* ───────────────────── 多文件：票券页 ───────────────────── */
  function initTicketPage(data) {
    initLook(data, makeStore({ meta: data.meta || {}, home: { tz: 'UTC' }, days: [], allEvents: [] }));

    function render() {
      var main = document.getElementById('main');
      if (!main) return;
      main.textContent = '';
      var t = data.ticket || {};
      var wrap = el('div', { class: 'ticket-wrap' });
      var tabs = el('div', { class: 'ticket-tabs' });
      (data.siblings || []).forEach(function (s) {
        var a = el('a', { href: s.href || '#', 'aria-current': String(s.id === t.id) }, (s.person || '') + ' · ' + (s.title || '票券'));
        tabs.appendChild(a);
      });
      if (tabs.children.length) wrap.appendChild(tabs);
      var card = el('div', { class: 'ticket-card' }, [
        el('h2', null, t.title || '票券'),
        t.person ? el('p', { class: 'person' }, '持有人：' + t.person) : null,
        el('img', { src: t.qr || '', alt: (t.person || '') + ' 的二维码' }),
        t.hint ? el('p', { class: 'hint' }, t.hint) : null
      ]);
      (t.links || []).forEach(function (l) { if (l && l.href) card.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener', class: 'ticket-back' }, l.label || '链接')); });
      card.appendChild(el('a', { class: 'ticket-back', href: 'index.html' }, '返回行程'));
      wrap.appendChild(card);
      main.appendChild(wrap);
      var foot = el('p', { class: 'foot' }, (data.meta || {}).footer || '');
      main.appendChild(foot);
    }

    var gate = data.meta && data.meta.gate;
    if (gate && gate.enabled && gate.passwordHash) mountGate({ meta: data.meta }, render);
    else render();
  }

  /* ───────────────────── 图标 ───────────────────── */
  function iconCalendar() {
    return svg('<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.8v3.4M16 2.8v3.4"/>');
  }
  function iconCheck() {
    return svg('<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4"/><path d="M7.6 12.4l3 3 5.8-6"/>');
  }
  function iconBook() {
    return svg('<path d="M4 4.8A2.8 2.8 0 016.8 2H20v17.6H7a3 3 0 00-3 3z"/><path d="M4 21.6V4.8M8.2 7.4h7.4M8.2 11.6h7.4"/>');
  }
  function svg(inner) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '20'); s.setAttribute('height', '20');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.7');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = inner;
    return s;
  }

  /* ───────────────────── 启动 ───────────────────── */
  function boot() {
    var mainData = parsesJson('trip-data');
    var ticketData = parsesJson('trip-ticket');
    if (mainData) {
      var gateCfg = mainData.meta && mainData.meta.gate;
      if (gateCfg && gateCfg.enabled && gateCfg.passwordHash) {
        mountGate(mainData, function () { initMain(mainData); });
      } else initMain(mainData);
    } else if (ticketData) initTicketPage(ticketData);
  }

  /* ───────────────────── 密码门 ───────────────────── */
  function mountGate(data, onUnlock) {
    var gateCfg = (data.meta && data.meta.gate) || data.gate || {};
    var key = 'tripcheat:' + hashStr((data.meta || {}).title || 'trip') + ':gate';
    try { if (localStorage.getItem(key) === 'ok') { onUnlock(); return; } } catch (e) {}
    var gate = document.getElementById('gate');
    if (!gate) { onUnlock(); return; }
    gate.hidden = false;
    gate.textContent = '';
    var form = document.createElement('form');
    var t = (data.meta || {}).title || '行程';
    form.innerHTML = '<h1>' + escapeHtml(t) + '</h1>' +
      '<label for="gate-pass">请输入访问密码</label>' +
      '<input id="gate-pass" type="password" autocomplete="current-password" enterkeyhint="go">' +
      '<p data-err hidden>密码不对，再试一次</p>' +
      '<button type="submit">打开行程</button>';
    gate.appendChild(form);
    var input = form.querySelector('input');
    var err = form.querySelector('[data-err]');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.hidden = true;
      if (window.crypto && crypto.subtle) {
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value)).then(function (buf) {
          var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
          if (hex === gateCfg.passwordHash) {
            try { localStorage.setItem(key, 'ok'); } catch (e) {}
            gate.hidden = true; gate.textContent = '';
            onUnlock();
          } else { err.hidden = false; input.select(); }
        });
      } else { err.hidden = false; err.textContent = '当前浏览器不支持本地校验，请换现代浏览器。'; }
    });
    input.focus();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
