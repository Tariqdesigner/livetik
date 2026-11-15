// أهداف البث المميزة: goals.html?type=heart|likes|follow|coins
// preview=1 = قيمة تجريبية 62% (معاينات البرنامج) ، والمحرر يرسل الإعدادات قبل حفظها عبر postMessage
// الثيمات: heart قلب زجاجي ، pulse شريط نبض ، flask قارورة ، crystals بلورات ، classic الشريط الكلاسيكي ، ring عدّاد دائري ، chip شريط مدمج
(function () {
  const P = new URLSearchParams(location.search);
  const TYPE = ['heart', 'likes', 'follow', 'coins'].includes(P.get('type')) ? P.get('type') : 'likes';
  const PREVIEW = P.get('preview') === '1';
  const FORCED_THEME = P.get('theme') || '';
  const stage = document.getElementById('stage');
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const NS = 'http://www.w3.org/2000/svg';
  const uid = Math.random().toString(36).slice(2, 7);

  const DEFAULTS = {
    heart: { title: 'Heart Me Goal', target: 100, color: '#ff3d7f', theme: 'heart', metric: 'gift' },
    likes: { title: 'Like Goal', target: 50000, color: '#ff2e4d', theme: 'pulse', metric: 'likes' },
    follow: { title: 'Follow Goal', target: 100, color: '#38bdf8', theme: 'flask', metric: 'follow' },
    coins: { title: 'Coin Goal', target: 5000, color: '#f5b400', theme: 'crystals', metric: 'coins' },
  };
  const SAMPLE = [{ nickname: 'Nova' }, { nickname: 'Layan' }, { nickname: 'Sarah' }, { nickname: 'Omar' }];
  const ICONS = {
    likes: '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.5 1.3 4.2 2.4h3.6c.7-1.1 2-2.4 4.2-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M2 7h20v4H2zM12 7v14M12 7S10 2.5 7.5 3.3 6.5 6.6 12 7zm0 0s2-4.5 4.5-3.7S17.5 6.6 12 7z"/>',
    follow: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
    coins: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    shares: '<path d="M14 4l7 7-7 7v-4c-5 0-8 1.5-11 5 1-5.5 4-10 11-11z"/>',
  };

  let cfg = { ...DEFAULTS[TYPE] };
  let progress = 0;
  let supporters = [];
  let testUntil = 0;
  let draftProgress = null;
  let lastValue = null;
  let lastRound = null;
  let holdUntil = 0;
  let built = '';
  let refs = {};

  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const svg = (html, vb) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb); s.innerHTML = html; return s; };
  const target = () => Math.max(1, Number(cfg.target) || DEFAULTS[TYPE].target);
  const theme = () => FORCED_THEME || cfg.theme || DEFAULTS[TYPE].theme;

  function rawValue() {
    // معاينة المحرر تعرض التقدّم الذي يكتبه المستخدم، وباقي المعاينات قيمة تجريبية 62%
    if (PREVIEW) return draftProgress !== null ? draftProgress : Math.round(target() * 0.62);
    if (Date.now() < testUntil) return target();
    return Number(progress) || 0;
  }

  // ---------- الخطوط (Google Fonts) ----------
  const loadedFonts = new Set();
  function useFont(name) {
    if (name && !loadedFonts.has(name)) {
      loadedFonts.add(name);
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700;800&display=swap`;
      document.head.append(l);
    }
    document.documentElement.style.setProperty('--ff', name ? `"${name}"` : '');
  }

  // ---------- أشكال مشتركة ----------
  const waves = (w) => `
    <g class="lvl"><path class="wv wv2" d="M0 8 Q ${w / 8} 0 ${w / 4} 8 T ${w / 2} 8 T ${(w * 3) / 4} 8 T ${w} 8 T ${(w * 5) / 4} 8 T ${(w * 3) / 2} 8 T ${(w * 7) / 4} 8 T ${w * 2} 8 V 400 H 0 Z"/>
    <path class="wv wv1" d="M0 8 Q ${w / 8} 16 ${w / 4} 8 T ${w / 2} 8 T ${(w * 3) / 4} 8 T ${w} 8 T ${(w * 5) / 4} 8 T ${(w * 3) / 2} 8 T ${(w * 7) / 4} 8 T ${w * 2} 8 V 400 H 0 Z"/></g>`;
  const bubbles = (n, x0, x1, y0) => Array.from({ length: n }, (_, i) => `<circle class="bb" cx="${(x0 + ((x1 - x0) * (i + 0.5)) / n).toFixed(1)}" cy="${y0}" r="${(1.6 + (i % 3)).toFixed(1)}" style="--d:${(2.2 + (i % 4) * 0.7).toFixed(1)}s;--de:-${(i * 0.53).toFixed(2)}s"/>`).join('');
  const HEART_PATH = 'M100 172 C 52 140 18 110 18 70 C 18 42 40 22 66 22 C 82 22 94 31 100 44 C 106 31 118 22 134 22 C 160 22 182 42 182 70 C 182 110 148 140 100 172 Z';
  const FLASK_PATH = 'M84 30 H116 V74 C 148 86 168 114 168 146 C 168 186 136 212 100 212 C 64 212 32 186 32 146 C 32 114 52 86 84 74 Z';
  const CRYSTALS = ['M38 168 L44 92 L58 70 L72 92 L76 168 Z', 'M70 168 L74 64 L92 30 L110 64 L114 168 Z', 'M108 168 L112 84 L128 58 L144 84 L146 168 Z', 'M22 168 L26 122 L36 106 L46 122 L48 168 Z', 'M140 168 L144 112 L156 94 L168 112 L170 168 Z'];

  function pill() {
    const p = h('div', 'pill');
    const title = h('span', 'ttl');
    const nums = h('span', 'nums');
    p.append(h('i', 'dot'), title, nums);
    return { p, title, nums };
  }

  // يُعاد البناء عند تغيّر ما يؤثر على الهيكل: الثيم، الاتجاه، الخلفية، موضع الفقاعة، أيقونة المقياس
  const buildKey = () => [theme(), cfg.orient || 'h', cfg.panel || 'dark', cfg.flip ? 1 : 0, cfg.bubbleSide || 'top', cfg.metric || ''].join('|');

  // ---------- الثيمات الإضافية ----------
  const icon = (cls) => { const d = h('div', cls); d.append(svg(ICONS[cfg.metric] || ICONS.likes, '0 0 24 24')); return d; };
  const numsEl = (cls) => h('div', 'nums' + (cls ? ' ' + cls : ''));
  const titleEl = (cls) => h('div', 'ttl' + (cls ? ' ' + cls : ''));
  // شريط عام: مسار + تعبئة (+ رأس متوهج اختياري)
  function bar(cls, withHead) {
    const track = h('div', 'track ' + cls);
    const fill = h('div', 'fill');
    track.append(fill);
    if (withHead) track.append(h('i', 'knob'));
    return { track, fill };
  }
  const isV = () => cfg.orient === 'v';
  const panel = () => (cfg.panel === 'glass' ? 'light' : 'dark');
  // حلقة SVG تمتلئ (للكبسولة الدائرية والأيقونة الدائرية)
  const ringSvg = () => svg(`<defs><linearGradient id="rg${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="st-c1"/><stop offset="1" class="st-c2"/></linearGradient></defs><circle class="rtrack" cx="60" cy="60" r="50"/><circle class="rfill" cx="60" cy="60" r="50" pathLength="100" stroke="url(#rg${uid})"/>`, '0 0 120 120');

  const EXTRA = {
    // زهور متوهجة بجانب شريط ناعم
    blossom(root, sup) {
      const fl = h('div', 'flowers');
      fl.innerHTML = '<svg viewBox="0 0 60 60">' + [[22, 20, 13], [36, 30, 12], [20, 38, 11]].map(([x, y, r]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="${r * 0.42}" ry="${r * 0.62}" cy="${-r * 0.55}" transform="rotate(${a})"/>`).join('')}<circle r="${r * 0.18}" class="ctr"/></g>`).join('') + '</svg>';
      const t = titleEl();
      const b = bar('soft', true);
      const n = numsEl();
      const col = h('div', 'bcol');
      col.append(t, b.track, n);
      const row = h('div', 'brow2');
      row.append(fl, col);
      root.append(row, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: n });
    },
    // أنبوب نيون بإطار كروم وكرة متوهجة عند رأس التعبئة
    neon(root, sup) {
      const t = titleEl();
      const b = bar('chrome', true);
      const n = numsEl('npill');
      root.append(t, b.track, n, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: n });
    },
    // مقاطع منفصلة تضيء بالتدرّج
    segments(root, sup) {
      const head = h('div', 'shead');
      const t = titleEl();
      const n = numsEl();
      head.append(t, n);
      const segs = h('div', 'segs');
      for (let i = 0; i < 22; i++) { const s = h('i'); s.style.setProperty('--k', i / 21); segs.append(s); }
      root.append(head, segs, sup);
      Object.assign(refs, { title: t, nums: n, segs, badge: head });
    },
    // شريط رفيع وفقاعة رقم تتبع رأس التعبئة (أفقي/عمودي، فوق/تحت)
    bubble(root, sup) {
      const wrap = h('div', `bwrap ${isV() ? 'v' : 'h'} side-${cfg.bubbleSide === 'bottom' ? 'bottom' : 'top'}`);
      const t = titleEl();
      const b = bar('thin', false);
      const bub = h('div', 'bub');
      const n = numsEl();
      bub.append(n);
      const dots = h('div', 'trail');
      for (let i = 0; i < 6; i++) { const d = h('i'); d.style.setProperty('--i', i); dots.append(d); }
      b.track.append(dots, bub);
      wrap.append(t, b.track);
      root.append(wrap, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: bub, bubTrack: b.track });
    },
    // كرت لعبة: أيقونة + رقم كبير + نسبة + شريط مخطط برأس متوهج
    card(root, sup) {
      const c = h('div', `gcard${isV() ? ' v' : ''}`);
      const ic = icon('cico');
      const t = titleEl();
      const n = numsEl('big');
      const pctB = h('div', 'ppill');
      const b = bar('striped', true);
      const info = h('div', 'cinfo');
      const top = h('div', 'ctop');
      top.append(t, pctB);
      info.append(top, n, b.track);
      c.append(ic, info);
      root.append(c, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, pctB, badge: info });
    },
    // واجهة HUD: لوحة داكنة بأقواس وعلامات وأيقونة
    hud(root, sup) {
      const p = h('div', `hud${isV() ? ' v' : ''}`);
      const ic = icon('hico');
      const t = titleEl();
      const b = bar('brk', true);
      for (let i = 1; i < 10; i++) { const k = h('i', 'tick'); k.style.setProperty('--k', i / 10); b.track.append(k); }
      const n = numsEl();
      p.append(ic, t, b.track, n);
      root.append(p, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: n });
    },
    // كاواي: زهرة على رأس الشريط، تعليقات متدلية، بتلات تتساقط
    kawaii(root, sup) {
      const t = titleEl();
      const deco = h('span', 'kdeco', '✦ ✧');
      const top = h('div', 'ktop');
      top.append(deco, t);
      const b = bar('kbar', false);
      const fl = h('div', 'kflower');
      fl.innerHTML = '<svg viewBox="-20 -20 40 40">' + [0, 72, 144, 216, 288].map((a) => `<path d="M0 -3 C -7 -8 -6 -17 0 -18 C 6 -17 7 -8 0 -3Z" transform="rotate(${a})"/>`).join('') + '<circle r="4" class="ctr"/></svg>';
      b.track.append(fl);
      for (let i = 0; i < 5; i++) { const pe = h('i', 'petal'); pe.style.setProperty('--i', i); b.track.append(pe); }
      const charms = h('div', 'charms');
      charms.append(h('span', '', '✿'), h('span', '', '★'));
      const n = numsEl();
      const bottom = h('div', 'kbot');
      bottom.append(charms, n);
      root.append(top, b.track, bottom, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: n });
    },
    // كبسولة: أيقونة + اسم + شريط صغير + رقم
    pillbar(root, sup) {
      const p = h('div', `capsule ${panel()}`);
      const ic = icon('pico');
      const t = titleEl();
      const b = bar('mini', false);
      const n = numsEl();
      p.append(ic, t, b.track, n);
      root.append(p, sup);
      Object.assign(refs, { title: t, nums: n, fill: b.fill, badge: t });
    },
    // كبسولة بحلقة تقدّم حول الأيقونة
    pillring(root, sup) {
      const p = h('div', `capsule ${panel()}`);
      const rw = h('div', 'pring');
      const r = ringSvg();
      rw.append(r, icon('rin'));
      const t = titleEl();
      const n = numsEl();
      p.append(rw, t, n);
      root.append(p, sup);
      Object.assign(refs, { title: t, nums: n, rfill: r.querySelector('.rfill'), badge: t });
    },
    // كبسولة تمتلئ خلفيتها نفسها
    pillfill(root, sup) {
      const p = h('div', `capsule cfill ${panel()}`);
      const f = h('div', 'cfillbg');
      const ic = icon('pico');
      const t = titleEl();
      const n = numsEl();
      const pc = h('div', 'ppill');
      p.append(f, ic, t, n, pc);
      root.append(p, sup);
      Object.assign(refs, { title: t, nums: n, cfill: f, pctB: pc, badge: t });
    },
    // أيقونة كبيرة بحلقة تقدّم
    iconring(root, sup) {
      const w = h('div', `iring ${panel()}`);
      const r = ringSvg();
      w.append(r, icon('rin'));
      const b = pill();
      root.append(w, b.p, sup);
      Object.assign(refs, { title: b.title, nums: b.nums, rfill: r.querySelector('.rfill'), badge: b.p });
    },
    // أيقونة دائرية تمتلئ بسائل متموّج
    iconfill(root, sup) {
      const s = svg(`<defs><clipPath id="ic${uid}"><circle cx="100" cy="100" r="86"/></clipPath></defs>
        <circle class="ibg" cx="100" cy="100" r="92"/>
        <g clip-path="url(#ic${uid})">${waves(200)}${bubbles(6, 50, 150, 185)}</g>
        <circle class="irim" cx="100" cy="100" r="92"/>`, '0 0 200 200');
      const v = h('div', `vessel ifill ${panel()}`);
      v.append(s, icon('iin'));
      const b = pill();
      root.append(v, b.p, sup);
      Object.assign(refs, { s, title: b.title, nums: b.nums, badge: b.p, y0: 186, y1: 14 });
    },
  };

  // ---------- بناء الثيم ----------
  function build() {
    const th = theme();
    built = buildKey();
    stage.replaceChildren();
    const root = h('div', `goal t-${th}`);
    refs = { root, th };
    const sup = h('div', 'sup');

    if (EXTRA[th]) {
      EXTRA[th](root, sup);
    } else if (th === 'heart' || th === 'flask') {
      const isHeart = th === 'heart';
      const shape = isHeart ? HEART_PATH : FLASK_PATH;
      const s = svg(`
        <defs><clipPath id="c${uid}"><path d="${shape}"/></clipPath>
        <linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="st-a"/><stop offset="1" class="st-b"/></linearGradient></defs>
        <path class="glass" d="${shape}"/>
        <g clip-path="url(#c${uid})">${waves(200)}${bubbles(isHeart ? 7 : 8, 50, 150, isHeart ? 170 : 205)}</g>
        <path class="rim" d="${shape}" stroke="url(#g${uid})"/>
        ${isHeart ? '<path class="shine" d="M46 52 C 52 40 64 36 74 38"/><g class="sparks"><path d="M100 4 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><path d="M178 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M20 30 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z"/></g>' : '<rect class="cork" x="80" y="8" width="40" height="26" rx="5"/><path class="shine" d="M52 128 C 50 112 58 98 70 90"/>'}`, isHeart ? '0 0 200 182' : '0 0 200 220');
      const pct = h('div', 'pct');
      const vessel = h('div', 'vessel');
      vessel.append(s, pct);
      const b = pill();
      if (isHeart) root.append(vessel, sup, b.p);
      else { const col = h('div', 'col'); col.append(b.p, sup); root.append(vessel, col); }
      Object.assign(refs, { s, pct, title: b.title, nums: b.nums, badge: b.p, y0: isHeart ? 172 : 212, y1: isHeart ? 22 : 74 });
    } else if (th === 'crystals') {
      const cs = CRYSTALS.map((d) => `<path d="${d}"/>`).join('');
      const s = svg(`
        <defs><clipPath id="cc${uid}">${cs}</clipPath><clipPath id="cl${uid}"><rect class="cut" x="0" y="168" width="200" height="0"/></clipPath>
        <linearGradient id="cg${uid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="st-a"/><stop offset="1" class="st-b"/></linearGradient></defs>
        <ellipse class="base" cx="96" cy="170" rx="86" ry="10"/>
        <g class="empty">${cs}</g>
        <g clip-path="url(#cl${uid})"><g class="full" fill="url(#cg${uid})">${cs}</g></g>
        <g clip-path="url(#cc${uid})"><rect class="sweep" x="-60" y="0" width="40" height="180"/></g>`, '0 0 200 182');
      const pct = h('div', 'pct');
      const vessel = h('div', 'vessel');
      vessel.append(s, pct);
      const badge = h('div', 'badgebox');
      const title = h('div', 'ttl');
      const nums = h('div', 'nums');
      badge.append(title, nums);
      root.append(vessel, badge, sup);
      Object.assign(refs, { s, pct, title, nums, badge, cut: s.querySelector('.cut') });
    } else if (th === 'ring') {
      const s = svg(`<circle class="rtrack" cx="60" cy="60" r="50"/><circle class="rfill" cx="60" cy="60" r="50" pathLength="100"/>`, '0 0 120 120');
      const pct = h('div', 'pct');
      const ico = h('div', 'rico');
      ico.append(svg(ICONS[cfg.metric] || ICONS.likes, '0 0 24 24'));
      const vessel = h('div', 'vessel');
      vessel.append(s, ico, pct);
      const b = pill();
      root.append(vessel, b.p, sup);
      Object.assign(refs, { s, pct, title: b.title, nums: b.nums, badge: b.p, rfill: s.querySelector('.rfill') });
    } else if (th === 'classic') {
      // الشريط الكلاسيكي بكل خياراته: الخلفية، الاتجاه، العكس، التدرّج
      const v = cfg.orient === 'v';
      const box = h('div', `classic bg-${cfg.panel || 'dark'}${v ? ' v' : ''}${cfg.flip ? ' flip' : ''}`);
      const ico = h('div', 'icon');
      ico.append(svg(ICONS[cfg.metric] || ICONS.likes, '0 0 24 24'));
      const head = h('div', 'head');
      const title = h('span', 'ttl');
      const nums = h('span', 'nums');
      head.append(title, nums);
      const track = h('div', 'track');
      const fill = h('div', 'fill');
      track.append(fill);
      box.append(ico, head, track);
      root.append(box, sup);
      Object.assign(refs, { title, nums, fill, badge: head });
    } else {
      // pulse (شريط نبض) و chip (شريط مدمج)
      const chip = th === 'chip';
      // أيقونة القلب مصمتة، وباقي الأيقونات خطية
      const badgeIco = h('div', 'bico' + ((cfg.metric || 'likes') === 'likes' ? ' solid' : ''));
      badgeIco.append(svg(ICONS[cfg.metric] || ICONS.likes, '0 0 24 24'));
      const title = h('div', 'ttl');
      const track = h('div', 'track');
      const fill = h('div', 'fill');
      track.append(fill);
      if (!chip) track.append(...[0.25, 0.5, 0.75].map((p) => { const t = h('i', 'tick'); t.style.left = p * 100 + '%'; return t; }));
      const nums = h('div', 'nums');
      const body = h('div', 'body');
      const top = h('div', 'brow');
      top.append(title, chip ? nums : h('span'));
      body.append(top, track);
      if (!chip) body.append(nums);
      const row = h('div', 'barrow');
      row.append(badgeIco, body);
      root.append(row, sup);
      Object.assign(refs, { title, nums, fill, badge: top, bico: badgeIco });
    }
    refs.sup = sup;
    stage.append(root);
  }

  // ---------- التحديث ----------
  function avatar(u, i) {
    const w = h('div', 'av' + (i < 3 ? ' r' + (i + 1) : ''));
    if (u.avatar) { const im = h('img'); im.src = u.avatar; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); w.append(im); }
    w.append(h('span', 'ini', (u.nickname || '?').slice(0, 1).toUpperCase()));
    return w;
  }

  function burst() {
    const box = h('div', 'burst');
    for (let i = 0; i < 18; i++) {
      const p = h('i');
      const a = (i / 18) * Math.PI * 2;
      p.style.setProperty('--x', (Math.cos(a) * (60 + Math.random() * 50)).toFixed(0) + 'px');
      p.style.setProperty('--y', (Math.sin(a) * (60 + Math.random() * 50)).toFixed(0) + 'px');
      p.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      box.append(p);
    }
    refs.root.append(box);
    setTimeout(() => box.remove(), 1600);
    // لافتة «تم الهدف» مع قصاصات ملونة للثيمات الكبيرة
    if (['segments', 'card', 'neon', 'hud', 'blossom', 'kawaii', 'bubble'].includes(refs.th)) {
      const ban = h('div', 'banner');
      ban.append(h('b', '', 'GOAL REACHED!'));
      for (let i = 0; i < 26; i++) {
        const c = h('i', 'conf');
        c.style.cssText = `--x:${(Math.random() * 240 - 120).toFixed(0)}%;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;--d:${(1.4 + Math.random()).toFixed(2)}s;--de:${(Math.random() * 0.3).toFixed(2)}s;--h:${(Math.random() * 360).toFixed(0)}`;
        ban.append(c);
      }
      refs.root.append(ban);
      setTimeout(() => ban.remove(), 3200);
    }
  }

  function update() {
    if (buildKey() !== built) build();
    const root = refs.root;
    root.style.setProperty('--c', cfg.color || DEFAULTS[TYPE].color);
    root.style.setProperty('--c2', cfg.color2 || cfg.color || DEFAULTS[TYPE].color);
    root.style.setProperty('--tx', cfg.textColor || '#ffffff');
    root.style.setProperty('--s', Math.max(0.4, Math.min(3, (Number(cfg.size) || 100) / 100)));
    useFont(cfg.font || '');

    const t = target();
    const raw = rawValue();
    // «إعادة البدء عند بلوغ الهدف»: يبقى ممتلئاً 4 ثوانٍ مع احتفال، ثم يعرض الباقي فوق الهدف كجولة جديدة
    let v = raw;
    let round = 0;
    if (cfg.loop && !PREVIEW && Date.now() >= testUntil) {
      round = Math.floor(raw / t);
      if (lastRound !== null && round > lastRound) holdUntil = Date.now() + 4000;
      v = Date.now() < holdUntil ? t : raw - round * t;
      lastRound = round;
      if (Date.now() < holdUntil) setTimeout(update, holdUntil - Date.now() + 50);
    }
    const p = Math.max(0, Math.min(1, v / t));
    const done = p >= 1;
    if (done && !root.classList.contains('done') && lastValue !== null) burst();
    root.classList.toggle('done', done);
    if (lastValue !== null && raw > lastValue) { root.classList.remove('bump'); void root.offsetWidth; root.classList.add('bump'); }
    lastValue = raw;

    const title = cfg.title || DEFAULTS[TYPE].title;
    refs.title.textContent = title;
    refs.title.classList.toggle('ar', /[؀-ۿ]/.test(title));
    if (refs.pct) refs.pct.textContent = Math.floor(p * 100) + '%';
    const numsTxt = [h('b', '', fmt(v)), h('span', 'of', ' / ' + fmt(t))];
    refs.nums.replaceChildren(...numsTxt);
    if (refs.badge) refs.badge.hidden = cfg.showBadge === false;

    // كل ثيم يحدّث ما يملكه: مستوى سائل، قص بلورات، حلقة، مقاطع، خلفية كبسولة، أو شريط
    if (refs.y0 !== undefined) {
      const y = refs.y0 - (refs.y0 - refs.y1) * p - 8;
      refs.s.querySelector('.lvl').style.transform = `translateY(${y.toFixed(1)}px)`;
    }
    if (refs.cut) {
      refs.cut.setAttribute('y', (168 - 140 * p).toFixed(1));
      refs.cut.setAttribute('height', (140 * p + 2).toFixed(1));
    }
    if (refs.rfill) refs.rfill.style.strokeDasharray = `${(p * 100).toFixed(2)} 100`;
    if (refs.fill) refs.fill.style.setProperty('--p', p);
    if (refs.bubTrack) refs.bubTrack.style.setProperty('--p', p);
    if (refs.segs) [...refs.segs.children].forEach((s, i, all) => s.classList.toggle('on', (i + 1) / all.length <= p + 0.0001));
    if (refs.cfill) refs.cfill.style.width = (p * 100).toFixed(1) + '%';
    if (refs.pctB) refs.pctB.textContent = Math.floor(p * 100) + '%';
    if (refs.fill) refs.fill.parentElement.style.setProperty('--p', p);

    const list = PREVIEW && !supporters.length ? SAMPLE : supporters;
    refs.sup.hidden = cfg.showSupporters === false || !list.length;
    refs.sup.replaceChildren(...list.slice(0, 5).map(avatar));
  }

  function applyState(g) {
    if (!g) return;
    if (g.config && g.config[TYPE]) cfg = { ...DEFAULTS[TYPE], ...g.config[TYPE] };
    if (g.progress) progress = g.progress[TYPE] || 0;
    if (g.supporters) supporters = g.supporters[TYPE] || [];
    update();
  }

  Overlay
    .on('snapshot', (s) => applyState(s.goals))
    .on('goals', applyState)
    .on('goals-test', (d) => { if (d.type !== TYPE) return; testUntil = Date.now() + 5000; update(); setTimeout(update, 5100); });

  // معاينة المحرر: الإعدادات قبل الحفظ
  addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'ld-goal-draft' && d.cfg) {
      cfg = { ...DEFAULTS[TYPE], ...d.cfg };
      if (Number.isFinite(d.progress)) draftProgress = d.progress;
      update();
    }
  });

  const go = () => update();
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
})();
