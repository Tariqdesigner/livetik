// تركيبات الأوفرلاي: widget.html?w=<id>
// preview=1 يعرض بيانات تجريبية عند عدم وجود بيانات حقيقية ، theme=<id> يفرض ثيماً (لمعاينة الثيمات في الخصائص)
(function () {
  const P = new URLSearchParams(location.search);
  const WID = P.get('w') || '';
  const PREVIEW = P.get('preview') === '1';
  const FORCED = P.get('theme') || '';
  const root = document.getElementById('root');
  const fxCanvas = document.getElementById('fx');
  const data = { stats: {}, latest: {}, state: null, rules: [], cfg: {}, themeFonts: {}, fonts: {} };
  const cfg = () => data.cfg[WID] || {};
  let THEME = '';

  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const text = (tag, cls, t) => { const e = h(tag, cls); e.textContent = t == null ? '' : t; return e; };

  const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#23232b"/><circle cx="32" cy="25" r="12" fill="#55555f"/><path d="M10 60a22 22 0 0 1 44 0z" fill="#55555f"/></svg>');
  const COIN = '<svg class="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#f5a70a"/><circle cx="12" cy="12" r="8.6" fill="#ffc92e" stroke="#e08e00" stroke-width="1"/><path fill="#7a4700" d="M13.4 6.5h1.7c.2 1.2 1 2 2.3 2.1v1.7a4.3 4.3 0 0 1-2.3-.7v3.9a3.6 3.6 0 1 1-3-3.5v1.8a1.8 1.8 0 1 0 1.3 1.7z"/></svg>';
  const avatar = (url) => {
    const i = h('img', 'av');
    i.referrerPolicy = 'no-referrer';
    i.src = url || SILHOUETTE;
    i.onerror = () => { i.onerror = null; i.src = SILHOUETTE; };
    return i;
  };
  // ---------- إطار صورة الحساب ----------
  let FRAME = null;
  // بناء الإطار ومؤثراته في frame-fx.js (مشترك مع بطاقة الداعم)
  const withFrame = (pic) => {
    if (!FRAME) return pic;
    pic.style.setProperty('--af', window.FrameFX.fit(FRAME));
    if (FRAME.under) pic.classList.add('fr-under');
    pic.append(window.FrameFX.build(FRAME, ''));
    return pic;
  };

  const netImg = (url, cls) => { const i = h('img', cls); i.referrerPolicy = 'no-referrer'; i.src = url; return i; };
  const SAMPLE_USER = { nickname: 'user', uniqueId: 'user', avatar: '' };
  const decoEl = (n) => { const d = h('div', 'deco'); for (let i = 0; i < n; i++) { const e = h('i'); e.style.setProperty('--n', i); e.style.setProperty('--x', Math.random().toFixed(3)); e.style.setProperty('--d', Math.random().toFixed(3)); e.style.setProperty('--z', Math.random().toFixed(3)); d.append(e); } return d; };

  // درجات لون واحد (k سالب أغمق، موجب أفتح)
  function shade(hex, k) {
    const n = parseInt(String(hex || '#ff1f3d').replace('#', '').slice(0, 6), 16) || 0;
    const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // ---------- عدّاد متحرك ----------
  function write(el, value) {
    const s = fmt(value);
    if (el.dataset.tiles) el.replaceChildren(...[...s].map((c) => text('span', c === ',' ? 'sep' : '', c)));
    else el.textContent = s;
  }
  function tween(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (from === to) return write(el, to);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      write(el, Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- لوحة الرسم ----------
  let ctx = null;
  let W = 0;
  let H = 0;
  function initCanvas() {
    fxCanvas.hidden = false;
    ctx = fxCanvas.getContext('2d');
    const size = () => {
      const d = Math.min(2, devicePixelRatio || 1);
      W = innerWidth;
      H = innerHeight;
      fxCanvas.width = W * d;
      fxCanvas.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    addEventListener('resize', size);
  }

  // ================= الويدجتات =================
  const LAST_ICON = {
    like: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.5 1.3 4.2 2.4h3.6c.7-1.1 2-2.4 4.2-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/></svg>',
    follow: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  };
  function lastWidget(kind, label) {
    let key = '';
    const draw = (item, force) => {
      const it = item || (PREVIEW ? { user: SAMPLE_USER, count: 15 } : null);
      if (!it) return root.replaceChildren();
      const k = `${it.user.uniqueId}|${it.count || ''}|${it.ts || ''}`;
      if (k === key && !force) return;
      key = k;
      const pic = h('div', 'pic');
      pic.append(avatar(it.user.avatar), h('span', 'badge', LAST_ICON[kind]));
      withFrame(pic);
      const txt = h('div', 'txt');
      txt.append(text('small', '', label), text('b', 'name', it.user.nickname || it.user.uniqueId));
      const box = h('div', 'last pop');
      const big = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      big.setAttribute('viewBox', '0 0 24 24');
      big.setAttribute('class', 'bigheart');
      big.innerHTML = '<path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.5 1.3 4.2 2.4h3.6c.7-1.1 2-2.4 4.2-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/>';
      box.append(big, pic, txt);
      if (kind === 'like' && it.count) box.append(text('span', 'cnt num', '×' + fmt(it.count)));
      root.replaceChildren(box);
    };
    return {
      render: () => draw(data.latest[kind]),
      test: () => draw({ user: { nickname: 'مستخدم تجريبي', uniqueId: 'test' + Date.now(), avatar: '' }, count: 25 }, true),
    };
  }

  // الرقم القادم: 1,655 => 2,000 ، 12,480 => 20,000
  function nextGoal(n) {
    const step = Math.pow(10, Math.max(2, Math.floor(Math.log10(Math.max(1, n)))));
    const goal = (Math.floor(n / step) + 1) * step;
    return { goal, pct: ((n - (goal - step)) / step) * 100 };
  }

  function totalWidget() {
    const pic = h('div', 'pic');
    const n = text('div', 'n num', '—');
    if (THEME === 'tf-odometer') n.dataset.tiles = '1';
    const t = text('div', 't', '');
    const next = h('div', 'next');
    const box = h('div', 'total');
    box.append(pic, n, t, next);
    root.append(box);
    let shownPic = null;
    return {
      render() {
        t.textContent = cfg().title || '';
        const o = (data.state && data.state.owner) || (PREVIEW ? { followers: 12480, avatar: '' } : null);
        const url = (o && o.avatar) || '';
        if (url !== shownPic) { shownPic = url; pic.replaceChildren(avatar(url)); withFrame(pic); }
        if (!o) return;
        const before = Number(n.dataset.v || 0);
        tween(n, o.followers);
        if (before && o.followers > before) { n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
        const g = nextGoal(o.followers);
        pic.style.setProperty('--pct', g.pct + '%');
        next.textContent = 'الهدف التالي: ';
        next.append(text('b', 'num', fmt(g.goal)));
      },
    };
  }

  function viewersWidget() {
    const box = h('div', 'viewers', '<div class="live-tag"><i></i>LIVE</div><div class="ico"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></div>');
    const right = h('div');
    const small = h('small', '', '<i></i><span></span>');
    const n = text('b', 'num', '0');
    right.append(small, n);
    box.append(right);
    box.insertAdjacentHTML('beforeend', '<svg class="ecg" viewBox="0 0 120 40"><path d="M0 22h34l5-9 7 23 8-30 6 21 4-5h56"/></svg>');
    root.append(box);
    return {
      render() {
        small.querySelector('span').textContent = cfg().title || '';
        tween(n, data.stats.viewers || (PREVIEW ? 1254 : 0));
      },
    };
  }

  function top3Widget() {
    const box = h('div', 'podium');
    root.append(box);
    let sig = null;
    let orderSig = null;
    let rows = [];
    const SAMPLE = [{ nickname: 'Sarah', diamonds: 4000 }, { nickname: 'عمر', diamonds: 3700 }, { nickname: 'Layan', diamonds: 1100 }];
    const RANK = THEME === 't3-rank';
    const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));
    const HEART_SVG = '<svg class="hrt" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.5 1.3 4.2 2.4h3.6c.7-1.1 2-2.4 4.2-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z"/></svg>';
    const writeVal = (b, d) => {
      if (!RANK) { b.textContent = fmt(d); return; }
      b.innerHTML = HEART_SVG;
      b.prepend(text('span', '', compact(d || 0)));
    };
    const pctOf = (g, max) => Math.max(6, ((g.diamonds || 0) / max) * 100) + '%';
    const build = (list, max) => {
      rows = [0, 1, 2].map((i) => {
        const g = list[i] || { nickname: '...', diamonds: 0 };
        const r = h('div', `rank r${i + 1}`);
        r.style.setProperty('--k', i);
        r.style.setProperty('--w', pctOf(g, max));
        if (i === 0) r.append(text('div', 'crown', '👑'));
        const pic = h('div', 'pic');
        const inner = h('div', 'inner');
        inner.append(avatar(g.avatar));
        pic.append(inner, text('span', 'num-b', i + 1));
        withFrame(pic);
        const val = h('div', 'val');
        const b = h('b', 'num');
        writeVal(b, g.diamonds);
        val.append(text('div', 'name', g.nickname || g.uniqueId), b);
        if (RANK) val.append(h('i', 'flag'), h('i', 'line'));
        r.append(pic, val);
        return { r, b, d: g.diamonds || 0 };
      });
      box.replaceChildren(...rows.map((x) => x.r));
    };
    const draw = () => {
      let list = (data.stats.topGifters || []).slice(0, 3);
      if (!list.length && PREVIEW) list = SAMPLE;
      const s = JSON.stringify(list.map((g) => [g.uniqueId, g.diamonds, g.avatar]));
      if (s === sig) return;
      sig = s;
      const max = Math.max(1, ...list.map((g) => g.diamonds || 0));
      const order = JSON.stringify(list.map((g) => g.uniqueId || g.nickname));
      // نفس الترتيب: تحديث القيم فقط بدون إعادة حركة الدخول، وتغيّر الترتيب يعيد الرسم
      if (order === orderSig && rows.length) {
        list.forEach((g, i) => {
          const row = rows[i];
          row.r.style.setProperty('--w', pctOf(g, max));
          if ((g.diamonds || 0) === row.d) return;
          row.d = g.diamonds || 0;
          writeVal(row.b, row.d);
          row.b.classList.remove('bump');
          void row.b.offsetWidth;
          row.b.classList.add('bump');
        });
        return;
      }
      orderSig = order;
      build(list, max);
    };
    return {
      render: draw,
      // زر التجربة يعيد حركة الدخول بالبيانات الحالية
      test() { sig = null; orderSig = null; draw(); },
    };
  }

  function giftImage(g, fallback) {
    if (g && g.image) return netImg(g.image, 'img');
    return text('div', 'emo', fallback);
  }

  function lastGiftWidget() {
    let key = null;
    const draw = (it, force) => {
      const item = it || (PREVIEW ? { user: { nickname: 'Sarah' }, gift: { name: 'Rose', repeatCount: 1, total: 1 } } : null);
      if (!item) return root.replaceChildren();
      const k = `${item.ts || ''}`;
      if (k === key && !force) return;
      key = k;
      const box = h('div', 'gift-w pop');
      const stage = h('div', 'stage', '<div class="glow"></div><div class="rays"></div>');
      stage.append(giftImage(item.gift, '🌹'), decoEl(12));
      box.append(text('div', 'title', cfg().title || ''), stage, text('div', 'who name', item.user.nickname || item.user.uniqueId), h('div', 'amt num', `${fmt(item.gift.total || item.gift.repeatCount || 1)} ${COIN}`));
      root.replaceChildren(box);
    };
    return {
      render: () => { draw(data.latest.gift); const t = root.querySelector('.title'); if (t) t.textContent = cfg().title || ''; },
      test: () => draw({ ts: Date.now(), user: { nickname: 'مستخدم تجريبي' }, gift: { name: 'Rose', repeatCount: 10, total: 10 } }, true),
    };
  }

  function topGiftWidget() {
    let sig = null;
    return {
      render() {
        const real = data.state && data.state.top;
        const t = real || (PREVIEW ? { name: 'Lion', diamonds: 29999, user: SAMPLE_USER, sample: true } : null);
        const s = JSON.stringify([t && t.name, t && t.diamonds, t && t.user && t.user.uniqueId, cfg().title]);
        if (s === sig) return;
        sig = s;
        if (!t) return root.replaceChildren();
        const box = h('div', 'gift-w top pop');
        const stage = h('div', 'stage', '<div class="glow"></div>');
        stage.append(giftImage(t, t.sample ? '🦁' : '🎁'));
        const user = h('div', 'user');
        const pic = h('div', 'pic');
        pic.append(avatar(t.user && t.user.avatar));
        withFrame(pic);
        user.append(pic, text('div', 'name', (t.user && (t.user.nickname || t.user.uniqueId)) || ''));
        box.append(text('div', 'title', cfg().title || ''), user, stage, h('div', 'amt num', `${COIN} ${fmt(t.diamonds)}`));
        root.replaceChildren(box);
      },
    };
  }

  function galleryWidget() {
    const PER = 8;
    const SAMPLE = [['Rose', '🌹', 1, 12], ['Heart', '💖', 5, 4], ['Star', '⭐', 99, 2], ['Lion', '🦁', 29999, 1]];
    let page = 0;
    let timer = null;
    let sig = null;
    const giftCard = (g, i) => {
      const c = h('div', 'g');
      c.style.setProperty('--i', i);
      if (g.image) c.append(netImg(g.image)); else c.append(text('div', 'emo', g.emo || '🎁'));
      c.append(text('div', 'name', g.name), text('div', 'c num', '×' + fmt(g.count)));
      return c;
    };
    const draw = () => {
      const real = (data.state && data.state.gallery) || [];
      const list = real.length ? real : PREVIEW ? SAMPLE.map(([name, emo, diamonds, count]) => ({ name, emo, diamonds, count })) : [];
      const box = h('div', 'gallery');
      box.append(h('div', 'hd', 'GIFT GALLERY<b class="num"></b>'));
      box.querySelector('b').textContent = list.length;
      clearTimeout(timer);
      if (!list.length) {
        box.append(text('div', 'none', 'لم تصل هدايا بعد'));
      } else if (THEME === 'gg-marquee') {
        // نكرر القائمة حتى يملأ الشريط الشاشة ويدور بلا انقطاع
        let row = list;
        while (row.length < 10) row = row.concat(list);
        const grid = h('div', 'grid');
        grid.style.setProperty('--dur', row.length * 2.4 + 's');
        row.concat(row).forEach((g, i) => grid.append(giftCard(g, i)));
        box.append(grid);
      } else {
        const pages = Math.max(1, Math.ceil(list.length / PER));
        page %= pages;
        const grid = h('div', 'grid');
        list.slice(page * PER, page * PER + PER).forEach((g, i) => grid.append(giftCard(g, i)));
        box.append(grid);
        if (list.length > PER) timer = setTimeout(() => { page++; draw(); }, Math.max(2, Number(cfg().seconds) || 6) * 1000);
      }
      root.replaceChildren(box);
    };
    return {
      render() {
        const s = JSON.stringify(((data.state && data.state.gallery) || []).map((g) => [g.name, g.count]));
        if (s === sig) return;
        sig = s;
        draw();
      },
    };
  }

  function sliderWidget() {
    const box = h('div', 'slider');
    root.append(box);
    let k = 0;
    let timer = null;
    const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
    const ICON = {
      gift: svg('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s.5 4 4 4zm0 0s1.5-5 4-4-.5 4-4 4z"/>'),
      command: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>'),
      follow: svg('<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>'),
      share: svg('<path d="M14 4l7 7-7 7v-4c-5 0-8 1.5-11 5 1-5.5 4-10 11-11z"/>'),
      likes: svg('<path d="M12 20s-7-4.3-9-8.6C1.6 8.3 3.4 5 6.6 5c2 0 3.2 1.2 3.9 2.2h3c.7-1 1.9-2.2 3.9-2.2 3.2 0 5 3.3 3.6 6.4C19 15.7 12 20 12 20z"/>'),
    };
    const BOLT = svg('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>');
    const list = () => (data.rules && data.rules.length ? data.rules : PREVIEW ? [{ type: 'gift', trigger: 'Rose', action: 'تشغيل أليرت' }, { type: 'likes', trigger: 'كل 100 لايك', action: 'نافورة قلوب' }, { type: 'follow', trigger: 'متابعة', action: 'رد في الشات' }] : []);
    const iconOf = (r) => { const ic = h('div', 'i'); if (r.image) ic.append(netImg(r.image)); else ic.innerHTML = ICON[r.type] || BOLT; return ic; };
    const slideOf = (r) => {
      const s = h('div', 'slide');
      const tx = h('div');
      tx.append(text('div', 'tr', r.trigger), text('div', 'ac', r.action));
      s.append(iconOf(r), tx);
      return s;
    };
    const wait = () => Math.max(2, Number(cfg().seconds) || 4) * 1000;
    const show = () => {
      clearTimeout(timer);
      const rules = list();
      if (!rules.length) return box.replaceChildren();
      if (THEME === 'as-ticker') {
        let row = rules;
        while (row.length < 8) row = row.concat(rules);
        const track = h('div', 'tick-track');
        track.style.setProperty('--dur', row.length * 4 + 's');
        row.concat(row).forEach((r) => {
          const it = h('div', 'tick-item');
          if (r.image) it.append(netImg(r.image)); else it.append(h('span', '', ICON[r.type] || BOLT));
          it.append(text('b', '', r.trigger), text('span', '', '←'), text('span', '', r.action));
          track.append(it);
        });
        return box.replaceChildren(text('div', 'tick-tag', 'الإجراءات'), track);
      }
      if (THEME === 'as-list') {
        const rows = rules.slice(0, 6).map(slideOf);
        box.replaceChildren(...rows);
        const tick = () => {
          rows.forEach((s, i) => s.classList.toggle('on', i === k % rows.length));
          k++;
          timer = setTimeout(tick, wait());
        };
        return tick();
      }
      const r = rules[k % rules.length];
      const s = slideOf(r);
      box.replaceChildren(s);
      timer = setTimeout(() => {
        if (rules.length < 2) return show();
        s.classList.add('out');
        setTimeout(() => { k++; show(); }, 380);
      }, wait());
    };
    return { render: show };
  }

  // ---------- ألعاب نارية ----------
  function fireworksWidget() {
    initCanvas();
    const caption = text('div', 'fx-caption', '');
    caption.hidden = true;
    root.append(caption);
    let capTimer = null;
    let rockets = [];
    let sparks = [];
    let likeAcc = 0;
    const brand = () => { const c = cfg().color; return [shade(c, 0), shade(c, 0.35), shade(c, 0.65), shade(c, -0.25)]; };
    const T = {
      'fw-classic': { colors: () => ['#ff3b5c', '#ffd23f', '#3ddcff', '#7cff6b', '#c77dff', '#ff8c42', '#ffffff'], life: [0.9, 1.6], grav: 140, drag: 1.5, tail: 0.02, width: 2 },
      'fw-gold': { colors: () => ['#ffd76a', '#ffb52e', '#fff0bf'], life: [1.8, 2.9], grav: 95, drag: 1.9, tail: 0.11, width: 1.6, n: 1.35 },
      'fw-neon': { colors: () => ['#25f4ee', '#ff2bd6', '#7cff00', '#8a5cff'], life: [0.7, 1.15], grav: 60, drag: 2.1, tail: 0.05, width: 3.4, glow: 14 },
      'fw-hearts': { colors: () => ['#ff3b6f', '#ff7eb0', '#ffc2d8'], life: [1, 1.5], grav: 45, drag: 1.2, tail: 0.02, width: 2.4, heart: true },
      'fw-brand': { colors: brand, life: [1, 1.7], grav: 120, drag: 1.5, tail: 0.04, width: 2.2 },
    };
    const th = T[THEME] || T['fw-classic'];
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const launch = (scale = 1) => {
      const power = (Number(cfg().power) || 100) / 100;
      rockets.push({ x: rnd(W * 0.15, W * 0.85), y: H + 10, vy: -rnd(H * 0.85, H * 1.15), ty: rnd(H * 0.12, H * 0.5), c: pick(th.colors()), scale: scale * power });
    };
    const explode = (r) => {
      const n = Math.min(190, Math.round(60 * r.scale * (th.n || 1)));
      const speed = Math.min(W, H) * 0.42 * Math.min(1.8, 0.75 + r.scale * 0.3);
      const c2 = pick(th.colors());
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let vx;
        let vy;
        if (th.heart) {
          // معادلة القلب: كل الشرارات تصنع شكل قلب
          const s = speed * 0.075 * rnd(0.94, 1.04);
          vx = 16 * Math.pow(Math.sin(a), 3) * s;
          vy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * s;
        } else {
          const v = speed * rnd(0.45, 1);
          vx = Math.cos(a + rnd(-0.05, 0.05)) * v;
          vy = Math.sin(a + rnd(-0.05, 0.05)) * v;
        }
        sparks.push({ x: r.x, y: r.y, vx, vy, life: rnd(th.life[0], th.life[1]), age: 0, c: i % 3 ? r.c : c2 });
      }
    };
    let last = performance.now();
    let nextDemo = 0;
    const frame = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = th.glow || 0;
      rockets = rockets.filter((r) => {
        r.y += r.vy * dt;
        r.vy *= 1 - 0.5 * dt;
        ctx.fillStyle = r.c;
        ctx.shadowColor = r.c;
        ctx.fillRect(r.x - 1.5, r.y, 3, 16);
        if (r.y <= r.ty) { explode(r); return false; }
        return true;
      });
      sparks = sparks.filter((s) => {
        s.age += dt;
        s.vx *= 1 - th.drag * dt;
        s.vy = s.vy * (1 - th.drag * dt) + th.grav * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
        ctx.strokeStyle = s.c;
        ctx.shadowColor = s.c;
        ctx.lineWidth = th.width;
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * th.tail - 0.5, s.y - s.vy * th.tail - 0.5);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        return s.age < s.life;
      });
      ctx.globalAlpha = 1;
      if (PREVIEW && t > nextDemo) { launch(rnd(0.7, 1.4)); nextDemo = t + 1400; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const showName = (name) => {
      if (!cfg().showName || !name) return;
      caption.textContent = name;
      caption.hidden = false;
      caption.classList.remove('pop');
      void caption.offsetWidth;
      caption.classList.add('pop');
      clearTimeout(capTimer);
      capTimer = setTimeout(() => (caption.hidden = true), 3500);
    };
    return {
      test() { launch(1); launch(1.6); setTimeout(() => launch(2.4), 350); showName('مستخدم تجريبي'); },
      gift(e) {
        if ((e.gift.total || 0) < (Number(cfg().minDiamonds) || 1)) return;
        // هدية أغلى = انفجار أكبر
        const scale = Math.min(3, 0.8 + Math.log10(Math.max(1, e.gift.total)) * 0.6);
        const n = Math.min(8, e.gift.repeatCount || 1);
        for (let i = 0; i < n; i++) setTimeout(() => launch(scale), i * 220);
        showName(e.user && (e.user.nickname || e.user.uniqueId));
      },
      like(e) {
        const every = Number(cfg().likesEvery) || 0;
        if (!every) return;
        likeAcc += e.likeCount || 1;
        if (likeAcc >= every) { likeAcc %= every; launch(0.8); }
      },
    };
  }

  // ---------- نافورة القلوب ----------
  function fountainWidget() {
    initCanvas();
    const caption = text('div', 'fx-caption num', '');
    caption.hidden = true;
    root.append(caption);
    let hearts = [];
    let acc = 0;
    const P_ = {
      'hf-rainbow': () => ['#ff3045', '#ff6fd8', '#7c5cff', '#2bd9ff', '#3fff6e', '#ffd23f', '#ff8c30', '#2b5cff'],
      'hf-rose': () => ['#ff1f55', '#ff4d7d', '#ff86a8', '#ffb9cd', '#c9103f'],
      'hf-balloons': () => ['#ff4d6d', '#ffb703', '#4cc9f0', '#b5179e', '#80ed99', '#fb8500'],
      'hf-cannons': () => ['#ff3045', '#ffd23f', '#2bd9ff', '#ff6fd8', '#ffffff'],
      'hf-mono': () => { const c = cfg().color; return [shade(c, 0), shade(c, 0.3), shade(c, 0.6), shade(c, -0.3)]; },
    };
    const palette = P_[THEME] || P_['hf-rainbow'];
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const shape = (s) => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.45, -s * 1.05, s, -s * 0.35, 0, s * 0.3);
      ctx.fill();
    };
    const spawn = (n) => {
      const power = (Number(cfg().height) || 100) / 100;
      const base = Math.max(0.7, Math.min(W, H) / 420);
      for (let i = 0; i < n; i++) {
        const c = pick(palette());
        if (THEME === 'hf-balloons') {
          hearts.push({ balloon: true, x: rnd(W * 0.08, W * 0.92), y: H + 30, vx: 0, vy: -rnd(H * 0.16, H * 0.3) * power, s: rnd(16, 30) * base, c, age: 0, life: 7, r: 0, ph: rnd(0, 6) });
        } else if (THEME === 'hf-cannons') {
          const left = Math.random() < 0.5;
          hearts.push({ x: left ? -10 : W + 10, y: H + 10, vx: (left ? 1 : -1) * rnd(W * 0.22, W * 0.5), vy: -rnd(H * 0.8, H * 1.25) * power, s: rnd(10, 20) * base, c, age: 0, life: rnd(2.2, 3.2), r: rnd(-0.5, 0.5) });
        } else {
          hearts.push({ x: W / 2 + rnd(-W * 0.015, W * 0.015), y: H + 10, vx: rnd(-W * 0.14, W * 0.14), vy: -rnd(H * 0.85, H * 1.3) * power, s: rnd(10, 22) * base, c, age: 0, life: rnd(2.2, 3.2), r: rnd(-0.4, 0.4) });
        }
      }
    };
    let last = performance.now();
    let nextDemo = 0;
    const frame = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, W, H);
      hearts = hearts.filter((p) => {
        p.age += dt;
        if (p.balloon) {
          p.y += p.vy * dt;
          p.x += Math.sin(p.age * 1.6 + p.ph) * 22 * dt;
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + p.s * 0.3);
          ctx.quadraticCurveTo(p.x + Math.sin(p.age * 3 + p.ph) * 8, p.y + p.s * 1.6, p.x, p.y + p.s * 2.8);
          ctx.stroke();
        } else {
          p.vy += H * 0.75 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, Math.min(1, (p.life - p.age) * 2));
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        shape(p.s);
        ctx.restore();
        return p.age < p.life && p.y < H + 40 && p.y > -80;
      });
      if (PREVIEW && t > nextDemo) { spawn(THEME === 'hf-balloons' ? 1 : 2); nextDemo = t + 450; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return {
      render() {
        caption.hidden = !cfg().showCount;
        caption.textContent = '❤ ' + fmt(data.stats.likes || 0);
      },
      test() { for (let i = 0; i < 6; i++) setTimeout(() => spawn(8), i * 160); },
      like(e) {
        acc += e.likeCount || 1;
        const per = Math.max(1, Number(cfg().likesPerHeart) || 5);
        const n = Math.floor(acc / per);
        if (!n) return;
        acc -= n * per;
        spawn(Math.min(40, n));
      },
    };
  }

  // ---------- جرة العملات ----------
  function jarWidget() {
    initCanvas();
    const total = h('div', 'jar-total num');
    root.append(total);
    const MAX = 170;
    const sprite = (paint) => { const c = document.createElement('canvas'); c.width = c.height = 48; paint(c.getContext('2d')); return c; };
    const coinS = sprite((g) => {
      g.fillStyle = '#e08e00'; g.beginPath(); g.arc(24, 24, 23, 0, 7); g.fill();
      g.fillStyle = '#ffc92e'; g.beginPath(); g.arc(24, 24, 19, 0, 7); g.fill();
      g.strokeStyle = '#f5a70a'; g.lineWidth = 2; g.beginPath(); g.arc(24, 24, 14, 0, 7); g.stroke();
      g.fillStyle = '#fff6'; g.beginPath(); g.ellipse(18, 16, 7, 4, -0.6, 0, 7); g.fill();
    });
    const orb = (c1, c2) => sprite((g) => {
      const r = g.createRadialGradient(17, 15, 2, 24, 24, 24);
      r.addColorStop(0, '#ffffff');
      r.addColorStop(0.22, c1);
      r.addColorStop(1, c2);
      g.fillStyle = r;
      g.beginPath(); g.arc(24, 24, 23, 0, 7); g.fill();
    });
    const gem = sprite((g) => {
      g.fillStyle = '#6fd8ff'; g.beginPath(); g.moveTo(10, 8); g.lineTo(38, 8); g.lineTo(47, 19); g.lineTo(24, 46); g.lineTo(1, 19); g.closePath(); g.fill();
      g.fillStyle = '#bff0ff'; g.beginPath(); g.moveTo(10, 8); g.lineTo(24, 19); g.lineTo(1, 19); g.closePath(); g.fill();
      g.fillStyle = '#2aa8e8'; g.beginPath(); g.moveTo(38, 8); g.lineTo(47, 19); g.lineTo(24, 19); g.closePath(); g.fill();
      g.fillStyle = '#e8fbff'; g.beginPath(); g.moveTo(24, 19); g.lineTo(14, 19); g.lineTo(24, 46); g.closePath(); g.fill();
    });
    const clamp01 = (t) => Math.max(0, Math.min(1, t));
    const JARS = {
      'cj-vase': {
        sprites: [coinS], radius: 1, floor: 0.965, stroke: 'rgba(255,255,255,.88)', fill: 'rgba(255,255,255,.05)', glow: 'rgba(255,255,255,.55)',
        profile: (t) => (t < 0.1 ? 0.5 - t * 1.5 : 0.35 + 0.28 * Math.sin(Math.PI * Math.pow((t - 0.1) / 0.9, 0.8)) - (0.12 * (t - 0.1)) / 0.9),
      },
      'cj-tube': {
        sprites: [orb('#7dff9e', '#0a8f3e'), orb('#c4ff5e', '#3f8f0a')], radius: 0.82, floor: 0.985, stroke: 'rgba(170,255,225,.9)', fill: 'rgba(90,255,180,.07)', glow: 'rgba(90,255,180,.75)',
        profile: (t) => (t < 0.03 ? 0.24 : t > 0.84 ? 0.2 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.84) / 0.16, 2))) : 0.2),
      },
      'cj-globe': {
        sprites: [orb('#ff5d7e', '#b00030'), orb('#ffd23f', '#c78400'), orb('#4cc9f0', '#0067a8'), orb('#7cff6b', '#159a1c'), orb('#c77dff', '#6a1fb0')], radius: 1.4, floor: 0.865, stroke: 'rgba(255,255,255,.9)', fill: 'rgba(255,255,255,.07)', glow: 'rgba(255,255,255,.6)',
        profile: (t) => {
          if (t < 0.05) return 0.14;
          if (t > 0.88) return 0.17 + (t - 0.88) * 0.8;
          return Math.sqrt(Math.max(0.0001, 0.42 * 0.42 - Math.pow(t - 0.46, 2)));
        },
        base: '#e0304a',
      },
      'cj-gems': {
        sprites: [gem], radius: 1.15, floor: 0.975, stroke: 'rgba(170,230,255,.92)', fill: 'rgba(120,210,255,.07)', glow: 'rgba(120,210,255,.7)',
        profile: (t) => (t < 0.05 ? 0.38 : 0.34),
      },
      'cj-cup': {
        sprites: [coinS], radius: 0.9, floor: 0.585, stroke: '#ffcf4a', fill: 'rgba(255,190,50,.1)', glow: 'rgba(255,190,50,.8)', handles: true,
        profile: (t) => {
          if (t < 0.6) return 0.36 - 0.26 * Math.pow(t / 0.6, 2.4);
          if (t < 0.84) return 0.055;
          return 0.055 + (t - 0.84) * 1.1;
        },
      },
    };
    const J = JARS[THEME] || JARS['cj-vase'];
    let coins = [];
    let jar = null;
    let seeded = false;
    let shown = -1;
    const layout = () => {
      const size = Math.min(H * 0.74, W * 0.72);
      jar = { cx: W / 2, top: H * 0.06, h: size, r: Math.max(5, size * 0.028 * J.radius) };
    };
    const halfW = (y) => J.profile(clamp01((y - jar.top) / jar.h)) * jar.h;
    const add = (n, instant) => {
      layout();
      const spread = Math.min(0.1, J.profile(0) * 0.6) * jar.h;
      for (let i = 0; i < n; i++) {
        coins.push({
          x: jar.cx + rnd(-spread, spread),
          y: instant ? jar.top + jar.h * rnd(J.floor * 0.35, J.floor * 0.95) : jar.top - rnd(10, 260),
          vx: rnd(-20, 20), vy: instant ? 0 : rnd(40, 120), rot: rnd(0, 6), spin: rnd(4, 11),
          spr: J.sprites[(Math.random() * J.sprites.length) | 0],
        });
      }
      if (coins.length > MAX) coins = coins.slice(coins.length - MAX);
    };
    const step = (dt) => {
      const r = jar.r;
      const floor = jar.top + jar.h * J.floor - r;
      for (const c of coins) {
        c.vy += 1500 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.spin * dt;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < coins.length; i++) {
          const a = coins[i];
          for (let j = i + 1; j < coins.length; j++) {
            const b = coins[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const min = r * 2;
            if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
            const d = Math.hypot(dx, dy) || 0.01;
            if (d >= min) continue;
            const push = (min - d) / 2;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
            a.vy *= 0.92; b.vy *= 0.92;
            a.vx *= 0.92; b.vx *= 0.92;
          }
          if (a.y > jar.top) {
            const w = Math.max(r, halfW(a.y) - r * 1.1);
            if (a.x < jar.cx - w) { a.x = jar.cx - w; a.vx = Math.abs(a.vx) * 0.3; }
            if (a.x > jar.cx + w) { a.x = jar.cx + w; a.vx = -Math.abs(a.vx) * 0.3; }
          }
          if (a.y > floor) { a.y = floor; a.vy *= -0.15; a.vx *= 0.8; }
        }
      }
    };
    const drawJar = (front) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([J.profile(t) * jar.h, jar.top + t * jar.h]); }
      ctx.save();
      ctx.lineJoin = 'round';
      if (!front) {
        ctx.beginPath();
        pts.forEach(([w, y], i) => (i ? ctx.lineTo(jar.cx - w, y) : ctx.moveTo(jar.cx - w, y)));
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(jar.cx + pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = J.fill;
        ctx.fill();
      } else {
        if (J.base) {
          // قاعدة آلة الكرات
          const y = jar.top + jar.h * 0.87;
          ctx.fillStyle = J.base;
          ctx.beginPath();
          ctx.moveTo(jar.cx - jar.h * 0.17, y);
          ctx.lineTo(jar.cx + jar.h * 0.17, y);
          ctx.lineTo(jar.cx + jar.h * 0.27, jar.top + jar.h);
          ctx.lineTo(jar.cx - jar.h * 0.27, jar.top + jar.h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = J.stroke;
        ctx.lineWidth = Math.max(2, jar.h * 0.011);
        ctx.shadowColor = J.glow;
        ctx.shadowBlur = 7;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          pts.forEach(([w, y], i) => (i ? ctx.lineTo(jar.cx + dir * w, y) : ctx.moveTo(jar.cx + dir * w, y)));
          ctx.stroke();
        }
        const rimW = J.profile(0) * jar.h;
        ctx.beginPath(); ctx.ellipse(jar.cx, jar.top, rimW, jar.h * 0.032, 0, 0, 7); ctx.stroke();
        const baseW = J.profile(1) * jar.h;
        if (baseW > jar.h * 0.03) { ctx.beginPath(); ctx.ellipse(jar.cx, jar.top + jar.h, baseW, jar.h * 0.028, 0, 0, 7); ctx.stroke(); }
        if (J.handles) {
          // مقبضا الكأس
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(jar.cx + dir * jar.h * 0.345, jar.top + jar.h * 0.08);
            ctx.bezierCurveTo(jar.cx + dir * jar.h * 0.56, jar.top + jar.h * 0.06, jar.cx + dir * jar.h * 0.54, jar.top + jar.h * 0.4, jar.cx + dir * jar.h * 0.23, jar.top + jar.h * 0.44);
            ctx.stroke();
          }
        }
        // لمعة الزجاج
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = Math.max(3, jar.h * 0.02);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const end = Math.min(0.62, J.floor * 0.8);
        let started = false;
        for (let t = 0.14; t < end; t += 0.03) {
          const x = jar.cx - J.profile(t) * jar.h * 0.8;
          const y = jar.top + t * jar.h;
          if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      layout();
      step(dt);
      ctx.clearRect(0, 0, W, H);
      drawJar(false);
      const size = jar.r * 2;
      for (const c of coins) {
        const moving = Math.abs(c.vy) > 60;
        const sx = moving && c.spr === coinS ? Math.max(0.2, Math.abs(Math.cos(c.rot))) : 1;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(sx, 1);
        ctx.drawImage(c.spr, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      drawJar(true);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const value = () => Math.max(1, Number(cfg().coinValue) || 1);
    return {
      render() {
        const amount = (data.state && data.state.jar) || 0;
        if (amount !== shown) {
          shown = amount;
          total.innerHTML = `${COIN} <span class="num"></span>`;
          total.querySelector('span').textContent = fmt(amount);
        }
        if (!seeded && data.state) {
          seeded = true;
          // معاينة الثيم بدون بيانات: عملات تجريبية حتى يظهر شكله
          const n = Math.floor(amount / value()) || (PREVIEW ? 45 : 0);
          add(Math.min(MAX, n), true);
        }
      },
      gift(e) { add(Math.min(40, Math.max(1, Math.floor((e.gift.total || 1) / value())))); },
      test() { add(25); },
      reset() { coins = []; },
    };
  }

  const BUILDERS = {
    'last-like': () => lastWidget('like', 'LAST LIKE'),
    'last-follow': () => lastWidget('follow', 'NEW FOLLOWER'),
    'total-followers': totalWidget,
    viewers: viewersWidget,
    top3: top3Widget,
    'top-gift': topGiftWidget,
    'last-gift': lastGiftWidget,
    'gift-gallery': galleryWidget,
    'actions-slider': sliderWidget,
    fireworks: fireworksWidget,
    'coin-jar': jarWidget,
    'heart-fountain': fountainWidget,
  };
  if (!BUILDERS[WID]) return;
  let widget = null;

  // ---------- الخطوط ----------
  const loaded = new Set();
  // خطوط محفوظة داخل البرنامج (fonts/) لا تحتاج تحميلاً من الإنترنت
  const LOCAL_FONTS = ['Outfit', 'Tajawal', 'Chakra Petch'];
  function loadFont(name) {
    if (!name || loaded.has(name) || LOCAL_FONTS.includes(name)) return;
    loaded.add(name);
    const all = { ...(data.fonts.arabic || {}), ...(data.fonts.latin || {}) };
    const axis = all[name];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}${axis ? ':' + axis : ''}&display=swap`;
    document.head.append(link);
  }

  function look() {
    const s = document.documentElement.style;
    const c = cfg();
    if (c.color) s.setProperty('--c', c.color);
    s.setProperty('--s', (Number(c.size) || 100) / 100);
    const font = c.font || (data.themeFonts[WID] || {})[THEME] || '';
    loadFont(font);
    if (font) s.setProperty('--ff', `"${font}", "Tajawal", "Segoe UI", sans-serif`);
  }

  const paint = () => {
    if (!widget) return;
    look();
    if (widget.render) widget.render();
  };

  const themeOf = () => FORCED || cfg().theme || '';
  const frameOf = () => P.get('frame') || cfg().frame || '';
  let frameId = '';

  Overlay
    .on('snapshot', (s) => {
      data.stats = s.stats || {};
      data.latest = s.latest || {};
      if (s.widgets) {
        data.cfg = s.widgets.config || {};
        data.state = s.widgets.state;
        data.rules = s.widgets.rules || [];
        data.themeFonts = s.widgets.themeFonts || {};
        data.fonts = s.widgets.fonts || {};
        data.frames = s.widgets.frames || [];
      }
      if (!widget) {
        // الثيم يُعرف من الإعدادات، لذلك يُبنى الويدجت بعد وصولها
        THEME = themeOf();
        document.documentElement.classList.add('th-' + THEME);
        frameId = frameOf();
        FRAME = (data.frames || []).find((f) => f.id === frameId) || null;
        if (FRAME) document.documentElement.classList.add('has-frame');
        look();
        widget = BUILDERS[WID]();
      }
      paint();
    })
    .on('stats', (s) => { data.stats = s; if (WID === 'viewers' || WID === 'top3' || WID === 'heart-fountain') paint(); })
    .on('latest', (d) => { data.latest[d.kind] = d.item; paint(); })
    .on('widgets-state', (s) => { data.state = s; if (WID !== 'actions-slider') paint(); })
    .on('widgets-config', (c) => {
      data.cfg = c;
      // تغيير الثيم يعيد بناء الصفحة حتى يُرسم الويدجت بتصميمه
      if (widget && (themeOf() !== THEME || frameOf() !== frameId)) return location.reload();
      paint();
    })
    .on('widgets-rules', (r) => { data.rules = r; paint(); })
    .on('widget-test', (d) => { if (d.id === WID && widget && widget.test) widget.test(); })
    .on('widget-reset', (d) => { if (d.id === WID && widget && widget.reset) widget.reset(); })
    .on('gift', (e) => widget && widget.gift && widget.gift(e))
    .on('like', (e) => widget && widget.like && widget.like(e));
})();
