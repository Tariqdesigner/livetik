// رسّام «التصنيف» — مشترك بين صفحة الأوفرلاي (OBS) ونافذة الإعدادات (معاينة مطابقة)
// RankRender.build(type, cfg, data, { base, frames, tab, animate }) => عنصر
//   data = { likes:[], gifts:[], shares:[], donations:[] } كل عنصر { name, avatar, value, currency? }
//   يعتمد على أصناف النص والعنوان والحركة من latest-widget.css (lt-name / lt-title / ltBounce…)
(function () {
  const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3550"/><stop offset="1" stop-color="#1c1a28"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="25" r="12" fill="#6d6788"/><path d="M10 62a22 22 0 0 1 44 0z" fill="#6d6788"/></svg>');
  const ICON = {
    likes: '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.5 1.3 4.2 2.4h3.6c.7-1.1 2-2.4 4.2-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z" fill="#ff3b6b"/>',
    gifts: '<circle cx="12" cy="12" r="9" fill="#ffc61a"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#a86b00" stroke-width="1.6"/>',
    shares: '<circle cx="18" cy="5" r="2.6" fill="#19d3a2"/><circle cx="6" cy="12" r="2.6" fill="#19d3a2"/><circle cx="18" cy="19" r="2.6" fill="#19d3a2"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4" stroke="#19d3a2" stroke-width="2"/>',
    donations: '<circle cx="12" cy="12" r="9" fill="#22c55e"/><path d="M14.6 8.6c-.5-.9-1.5-1.4-2.7-1.4-1.6 0-2.7.9-2.7 2.1 0 2.9 5.6 1.5 5.6 4.5 0 1.3-1.2 2.2-2.9 2.2-1.3 0-2.4-.6-2.9-1.6M12 5.6v1.6M12 16v1.6" stroke="#04210f" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  };
  const CROWN = '<svg viewBox="0 0 24 16"><path d="M2 14 0 3l6.5 4.5L12 0l5.5 7.5L24 3l-2 11z" fill="currentColor"/><circle cx="12" cy="9.5" r="1.8" fill="rgba(0,0,0,.35)"/></svg>';
  const TAB_NAME = { likes: 'اللايكات', gifts: 'الهدايا', shares: 'المشاركات' };
  const SRC = { likes: 'likes', gifts: 'gifts', shares: 'shares', top20: 'gifts', donations: 'donations' };

  // التصاميم: [id, الاسم, الشكل]
  const DESIGNS = [
    ['custom', 'شكل خاص', 'podium'], ['redink', 'منصة الحبر الأحمر', 'podium'], ['nightclouds', 'منصة غيوم الليل', 'podium'], ['skulls', 'منصة الجماجم', 'podium'], ['saudi', 'المنصة السعودية', 'podium'],
    ['butterfly', 'شرائط الفراشة', 'list'], ['royal', 'الشرائط الملكية', 'list'], ['bow', 'شرائط الفيونكة', 'list'], ['cyber', 'سايبر', 'list'], ['blackgold', 'الذهب الأسود', 'list'],
    ['plasma', 'بلازما', 'list'], ['strip', 'شريط أفقي', 'strip'], ['bubbles', 'فقاعات', 'bubbles'],
  ];
  const LAYOUT = Object.fromEntries(DESIGNS.map(([id, , l]) => [id, l]));
  // ألوان كل تصميم وإطاره — تنطبق لما تختار التصميم، وبعدها تقدر تعدّل أي شيء ('@' = لون التصنيف الحالي)
  const PRESETS = {
    custom: { box: { bg: '#161a40', border: '@', radius: 10, glow: 55, bw: 1.5, opacity: 95 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'frame', color: '@' }, frame: 'none' },
    redink: { color: '#ff2a3d', box: { bg: '#1c0507', border: '#ff2a3d', radius: 4, glow: 60, bw: 2, opacity: 92 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'frame', color: '#ff2a3d' }, frame: 'dc120' },
    nightclouds: { color: '#8fc1ff', box: { bg: '#0d1a3a', border: '#8fc1ff', radius: 14, glow: 50, bw: 1.5, opacity: 92 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'glass', color: '#8fc1ff' }, frame: 'dc83' },
    skulls: { color: '#e8e2d0', box: { bg: '#121212', border: '#e8e2d0', radius: 6, glow: 30, bw: 2, opacity: 95 }, name: { style: 'plain', color: '#f4efe2' }, title: { shape: 'frame', color: '#e8e2d0' }, frame: 'dc34' },
    saudi: { color: '#d4af37', box: { bg: '#0b5d2e', border: '#d4af37', radius: 12, glow: 45, bw: 2, opacity: 96 }, name: { style: 'metal', color: '#f3d27a' }, title: { shape: 'filled', color: '#d4af37' }, frame: 'dc54' },
    butterfly: { color: '#f5c542', box: { bg: '#1a1408', border: '#f5c542', radius: 99, glow: 40, bw: 2, opacity: 95 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'frame', color: '#f5c542' }, frame: 'none' },
    royal: { color: '#e6c35c', box: { bg: '#1a1206', border: '#e6c35c', radius: 8, glow: 35, bw: 2, opacity: 96 }, name: { style: 'metal', color: '#f3d27a' }, title: { shape: 'ribbon', color: '#e6c35c' }, frame: 'none' },
    bow: { color: '#ff7eb6', box: { bg: '#ffd6e7', border: '#ff7eb6', radius: 99, glow: 30, bw: 2, opacity: 96 }, name: { style: 'plain', color: '#8a1f52' }, title: { shape: 'filled', color: '#ff7eb6' }, frame: 'none' },
    cyber: { color: '#19e3ff', box: { bg: '#070b16', border: '#19e3ff', radius: 0, glow: 50, bw: 1.5, opacity: 92 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'slant', color: '#19e3ff' }, frame: 'none' },
    blackgold: { color: '#d4af37', box: { bg: '#050505', border: '#d4af37', radius: 6, glow: 35, bw: 1.5, opacity: 96 }, name: { style: 'shine', color: '#f3d27a' }, title: { shape: 'frame', color: '#d4af37' }, frame: 'none' },
    plasma: { box: { bg: '#120a26', border: '@', radius: 99, glow: 70, bw: 1.5, opacity: 90 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'frame', color: '@' }, frame: 'none' },
    strip: { box: { bg: '#161a40', border: '@', radius: 99, glow: 40, bw: 1.5, opacity: 92 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'frame', color: '@' }, frame: 'none' },
    bubbles: { box: { bg: '#161a40', border: '@', radius: 10, glow: 55, bw: 1.5, opacity: 95 }, name: { style: 'plain', color: '#ffffff' }, title: { shape: 'glass', color: '@' } },
  };
  // يطبّق ألوان التصميم على إعدادات (نسخة) — يستخدمه التطبيق لما المستخدم يختار تصميم
  function applyPreset(cfg, id) {
    const p = PRESETS[id] || {};
    cfg.design = id;
    if (p.color) cfg.color = p.color;
    const c = cfg.color;
    const at = (v) => (v === '@' ? c : v);
    if (p.box) for (const [k, v] of Object.entries(p.box)) cfg.box[k] = at(v);
    if (p.name) { cfg.name.style = p.name.style; cfg.name.color = p.name.color; cfg.name.glow = c; cfg.name.c1 = c; }
    if (p.title) { cfg.title.shape = p.title.shape; cfg.title.color = at(p.title.color); }
    if (p.frame) cfg.avatar.frames = { r1: p.frame, r2: p.frame, r3: p.frame, rest: p.frame };
    return cfg;
  }

  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const svgIc = (k) => { const s = h('span', 'rk-ic'); s.innerHTML = `<svg viewBox="0 0 24 24">${ICON[k] || ICON.gifts}</svg>`; return s; };
  const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const mix = (a, b, t) => { const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : Number(n).toLocaleString('en-US'));
  function money(v, cur) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(v); } catch (_) { return Number(v).toFixed(2); }
  }
  const valText = (kind, x) => (kind === 'donations' ? money(x.value, x.currency) : compact(x.value));
  const short = (s) => { const a = [...String(s || '')]; return a.length > 14 ? a.slice(0, 13).join('') + '…' : a.join(''); };
  const rankCls = (r) => `rk-r${r <= 3 ? r : 'n'}`;

  function frameFor(cfg, rank) { const f = cfg.avatar.frames || {}; return rank <= 3 ? f['r' + rank] : f.rest; }

  function avatar(cfg, x, rank, size, o) {
    const wrap = h('div', `rk-av ${rankCls(rank)}`);
    wrap.style.setProperty('--s', `calc(${size}px * var(--avs))`);
    const pic = h('div', 'pic');
    const img = h('img', 'av');
    img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.src = x.avatar || SILHOUETTE;
    img.onerror = () => { img.onerror = null; img.src = SILHOUETTE; };
    pic.append(img);
    const fid = frameFor(cfg, rank) || 'none';
    const frame = fid !== 'none' && (o.frames || []).find((f) => f.id === fid);
    if (frame && frame.w && window.FrameFX) {
      wrap.classList.add('has-frame');
      pic.style.setProperty('--af', window.FrameFX.fit(frame));
      if (frame.under) pic.classList.add('fr-under');
      pic.append(window.FrameFX.build(frame, o.base || ''));
    } else if (['ring', 'spin', 'double', 'dash'].includes(fid)) wrap.classList.add('rk-cf-' + fid);
    wrap.append(pic, h('b', 'rk-badge', String(rank)));
    return wrap;
  }

  function nameEl(cfg, text) {
    const n = cfg.name;
    const nm = h('div', `lt-name rk-name lt-n-${n.style}${n.shimmer ? ' lt-shim' : ''}${n.stroke ? ' lt-stroke' : ''}${n.flicker > 0 ? ' lt-flick' : ''}`);
    nm.style.fontFamily = `'${n.font}', 'Tajawal', sans-serif`;
    const t = short(text);
    nm.append(h('span', '', t));
    nm.dataset.text = t;
    return nm;
  }
  function valueEl(cfg, kind, x) {
    if (!cfg.showValues) return null;
    const v = h('span', 'rk-val');
    v.append(document.createTextNode(valText(kind, x)), svgIc(kind));
    return v;
  }
  const box = (cls, ...kids) => { const b = h('div', 'rk-box ' + cls); b.append(...kids.filter(Boolean)); return b; };
  const item = (el, i) => { el.classList.add('rk-item'); el.style.setProperty('--i', i); return el; };

  // ---- منصة ----
  const P_AV = [120, 96, 96, 80, 80];
  function podium(cfg, kind, list, o) {
    const wrap = h('div', 'rk-podium');
    const five = cfg.box.side && list.length >= 4;
    const order = five ? [3, 1, 0, 2, 4] : [1, 0, 2];
    for (const i of order) {
      const x = list[i];
      const col = h('div', `rk-pcol rk-p${i + 1}`);
      if (!x) { col.classList.add('rk-empty'); wrap.append(col); continue; }
      if (i === 0) { const c = h('span', 'rk-crown'); c.innerHTML = CROWN; col.append(c); }
      if (cfg.avatar.show) col.append(avatar(cfg, x, i + 1, P_AV[i], o));
      col.append(box('rk-pcard', nameEl(cfg, x.name), valueEl(cfg, kind, x)));
      wrap.append(item(col, i));
    }
    return { el: wrap, used: five ? 5 : 3 };
  }

  // ---- صفوف ----
  function rows(cfg, kind, list, start, o) {
    const wrap = h('div', 'rk-list' + (list.length > 8 ? ' rk-two' : ''));
    const max = list[0] ? list[0].value : 1;
    list.forEach((x, i) => {
      const rank = start + i;
      const row = h('div', `rk-row ${rankCls(rank)}`);
      row.style.setProperty('--w', Math.max(0.2, x.value / (max || 1)).toFixed(3));
      const lead = cfg.avatar.show ? avatar(cfg, x, rank, 54, o) : h('b', 'rk-num', String(rank));
      row.append(lead, box('rk-bar', nameEl(cfg, x.name), valueEl(cfg, kind, x)));
      wrap.append(item(row, i));
    });
    return wrap;
  }

  // ---- شريط أفقي ----
  function strip(cfg, kind, list, o) {
    const wrap = h('div', 'rk-strip');
    list.forEach((x, i) => {
      const chip = box('rk-chip', h('b', `rk-num ${rankCls(i + 1)}`, String(i + 1)), cfg.avatar.show ? avatar(cfg, x, i + 1, 40, o) : null, nameEl(cfg, x.name), valueEl(cfg, kind, x));
      chip.classList.add(rankCls(i + 1));
      wrap.append(item(chip, i));
    });
    return wrap;
  }

  // ---- فقاعات ----
  const B_AV = [110, 92, 92, 80, 80];
  function bubbles(cfg, kind, list, o) {
    const wrap = h('div', 'rk-bubbles');
    list.forEach((x, i) => {
      const b = h('div', `rk-bub ${rankCls(i + 1)}`);
      if (i === 0) { const c = h('span', 'rk-crown'); c.innerHTML = CROWN; b.append(c); }
      b.append(avatar(cfg, x, i + 1, B_AV[i] || 72, o), nameEl(cfg, x.name));
      const v = valueEl(cfg, kind, x);
      if (v) b.append(v);
      wrap.append(item(b, i));
    });
    return wrap;
  }

  function title(cfg) {
    const t = cfg.title;
    const el = h('div', `lt-title rk-title lt-t-${t.shape}${t.shimmer ? ' lt-shim' : ''}`);
    el.append(h('span', '', t.text));
    el.dataset.text = t.text;
    el.style.setProperty('--tc', t.color);
    el.style.fontFamily = `'${t.font}', 'Outfit', 'Tajawal', sans-serif`;
    el.style.transform = `translate(${t.dx}px, ${t.dy}px)`;
    return el;
  }

  function build(type, cfg, data, opts) {
    const o = opts || {};
    data = data || {};
    const layout = LAYOUT[cfg.design] || 'podium';
    const b = cfg.box, n = cfg.name;
    const root = h('div', `rk rk-t-${type} rk-d-${cfg.design} rk-l-${layout}${b.show ? '' : ' rk-nobox'}${b.edge ? ' rk-edgelit' : ''}`);
    const glowPx = (n.glowPower / 100) * 24;
    const vars = {
      '--c': cfg.color,
      '--bx-bg': rgba(b.bg, b.opacity / 100), '--bx-bd': b.border, '--bx-bw': b.bw + 'px', '--bx-r': b.radius + 'px', '--bx-glow': ((b.glow / 100) * 30).toFixed(1) + 'px',
      '--bx-ga': rgba(b.border, 0.75), '--bx-s': (b.size / 100).toFixed(2), '--gap': b.gap + 'px', '--avs': (b.avSize / 100).toFixed(2), '--avg': b.avGap + 'px',
      '--ns': (cfg.nameSize / 100).toFixed(2), '--vs': (cfg.valueSize / 100).toFixed(2),
      '--nc': n.color, '--ng': n.glow, '--ng-a': rgba(n.glow, 0.85), '--n1': n.c1, '--n2': n.c2, '--nhi': mix(n.color, '#ffffff', 0.55), '--nlo': mix(n.color, '#000000', 0.45),
      '--glow': glowPx.toFixed(1) + 'px', '--flick': (n.flicker / 100).toFixed(2),
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    if (cfg.motion && cfg.motion.animate && o.animate) root.classList.add('rk-in', 'rk-a-' + cfg.motion.anim);

    const head = [];
    if (cfg.title.show && cfg.title.pos === 'above') head.push(title(cfg));
    let kind = SRC[type] || 'gifts';
    if (type === 'live') {
      kind = o.tab && cfg.tabs.includes(o.tab) ? o.tab : cfg.tabs[0];
      const tabs = h('div', 'rk-tabs');
      for (const t of ['likes', 'gifts', 'shares']) if (cfg.tabs.includes(t)) tabs.append(h('span', 'rk-tab' + (t === kind ? ' on' : ''), TAB_NAME[t]));
      head.push(tabs);
    }
    root.append(...head);
    const list = (data[kind] || []).slice(0, cfg.count);
    if (!list.length) root.append(h('div', 'rk-wait', 'بانتظار أول تفاعل…'));
    else if (layout === 'podium') {
      const p = podium(cfg, kind, list, o);
      root.append(p.el);
      const rest = list.slice(p.used);
      if (rest.length) root.append(rows(cfg, kind, rest, p.used + 1, o));
    } else if (layout === 'strip') root.append(strip(cfg, kind, list, o));
    else if (layout === 'bubbles') root.append(bubbles(cfg, kind, list, o));
    else root.append(rows(cfg, kind, list, 1, o));
    if (cfg.title.show && cfg.title.pos === 'below') root.append(title(cfg));
    return root;
  }

  // بيانات تجريبية للمعاينة وزر «تجربة»
  const NAMES = ['عمر', 'يوسف', 'Omar', 'خالد', 'ريم', 'مايك', 'سارة', 'Fahad', 'نورة', 'Tariq', 'عبدالله', 'Lina', 'ماجد', 'هيا', 'Zaid', 'دانة', 'Saad', 'جود', 'منيرة', 'Rami'];
  function sample() {
    // تناقص تدريجي (كل مركز أقل بـ 12%) حتى آخر المراكز تبقى أرقام واقعية
    const mk = (base) => NAMES.map((name, i) => ({ name, avatar: '', value: Math.max(1, Math.round(base * Math.pow(0.88, i))) }));
    return {
      likes: mk(4200), gifts: mk(31800), shares: mk(40),
      donations: NAMES.map((name, i) => ({ name, avatar: '', value: Math.max(1, Math.round(150 * Math.pow(0.86, i) * 100) / 100), currency: 'USD' })),
    };
  }

  window.RankRender = { build, sample, applyPreset, DESIGNS, PRESETS, LAYOUT, SILHOUETTE };
})();
