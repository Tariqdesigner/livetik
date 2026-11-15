// شاشة وقت الصلاة (Browser Source 1920×1080).
// ?preview=1 خلفية مربعات للمعاينة  ?theme=… يفرض ثيم  ?now=ISO يثبّت الوقت (للتجربة)
(function () {
  const P = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  if (P.get('preview')) document.body.classList.add('preview');
  const fixedNow = P.get('now') ? new Date(P.get('now')) : null;
  const startedAt = Date.now();
  // مع ?now نخلّي الساعة تمشي من الوقت المثبّت (العداد يتحرك طبيعي)
  const now = () => (fixedNow ? new Date(fixedNow.getTime() + (Date.now() - startedAt)) : new Date());

  let cfg = null;
  let loc = null;
  let refs = {};
  let timer = 0;

  // ---------- الألوان (بدون color-mix: متصفح OBS قد يكون قديم) ----------
  const rgb = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const rgba = (hex, a) => `rgba(${rgb(hex).join(', ')}, ${a})`;
  function colors(p, t, a) {
    const v = { '--a': a, '--a-hi': mix(a, '#ffffff', 0.4), '--a-a55': rgba(a, 0.55), '--p': p, '--p-hi': mix(p, '#ffffff', 0.45), '--p-lo': mix(p, '#000000', 0.32), '--p-a08': rgba(p, 0.08), '--p-a15': rgba(p, 0.15), '--p-a35': rgba(p, 0.35), '--p-a55': rgba(p, 0.55), '--t': t, '--t-a70': rgba(t, 0.72), '--t-a50': rgba(t, 0.5) };
    for (const [k, val] of Object.entries(v)) stage.style.setProperty(k, val);
  }

  // ---------- الزخارف (SVG بإحداثيات المسرح 1920×1080) ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (inner) => `<svg xmlns="${NS}" viewBox="0 0 1920 1080" preserveAspectRatio="none">${inner}</svg>`;
  const DEFS = `<defs>
    <radialGradient id="lg" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="var(--p-hi)" stop-opacity=".95"/><stop offset=".6" stop-color="var(--p)" stop-opacity=".55"/><stop offset="1" stop-color="var(--p-lo)" stop-opacity=".35"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="var(--p)" stop-opacity=".35"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--p-hi)"/><stop offset=".55" stop-color="var(--p)"/><stop offset="1" stop-color="var(--p-lo)"/></linearGradient>
    <linearGradient id="archFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--p)" stop-opacity=".12"/><stop offset="1" stop-color="var(--p)" stop-opacity=".02"/></linearGradient>
  </defs>`;

  // نجوم صغيرة متلألئة بمواقع ثابتة (نفس الشكل كل مرة)
  function stars(n) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    let s = '<g class="pt-stars">';
    for (let i = 0; i < n; i++) {
      const x = 80 + rnd() * 1760, y = 70 + rnd() * 800;
      if (x > 520 && x < 1400 && y > 180 && y < 900) continue; // نخلي الوسط نظيف للنص
      s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1.2 + rnd() * 2.2).toFixed(1)}" style="animation-delay:${(-rnd() * 3.4).toFixed(2)}s"/>`;
    }
    return s + '</g>';
  }
  const diamond = (x, y, s) => `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" transform="rotate(45 ${x} ${y})" fill="var(--p)"/>`;
  const FRAME = `<rect x="40" y="40" width="1840" height="1000" fill="none" stroke="var(--p)" stroke-width="3"/>
    <rect x="56" y="56" width="1808" height="968" fill="none" stroke="var(--p-a35)" stroke-width="1.5"/>
    ${diamond(40, 40, 26)}${diamond(1880, 40, 26)}${diamond(40, 1040, 26)}${diamond(1880, 1040, 26)}`;
  // نجمة ثمانية (مربعين متقاطعين)
  const star8 = (cx, cy, s, attrs) => `<g ${attrs || ''}><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}"/><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" transform="rotate(45 ${cx} ${cy})"/></g>`;
  let maskN = 0;
  const crescent = (cx, cy, r) => { const id = 'cm' + (++maskN); return `<mask id="${id}"><rect width="1920" height="1080" fill="#fff"/><circle cx="${cx - r * 0.42}" cy="${cy - r * 0.2}" r="${r * 0.84}" fill="#000"/></mask><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gold)" mask="url(#${id})"/>`; };

  function lantern(x, chain, s, cls) {
    return `<g class="pt-lantern ${cls || ''}">
      <line x1="${x}" y1="0" x2="${x}" y2="${chain}" stroke="var(--p-a55)" stroke-width="2"/>
      <g transform="translate(${x} ${chain}) scale(${s})">
        <circle class="pt-glow" cx="0" cy="82" r="120" fill="url(#halo)"/>
        <circle cx="0" cy="-6" r="7" fill="none" stroke="var(--p)" stroke-width="3"/>
        <path d="M-26 18 L0 0 L26 18 Z" fill="url(#gold)"/>
        <rect x="-31" y="17" width="62" height="9" rx="2" fill="var(--p)"/>
        <path class="pt-glow" d="M-30 26 L-41 72 L-34 130 L34 130 L41 72 L30 26 Z" fill="url(#lg)" stroke="var(--p)" stroke-width="3"/>
        <path d="M-12 26 L-15 130 M12 26 L15 130 M-41 72 L41 72" stroke="var(--p-lo)" stroke-width="2" opacity=".8"/>
        <rect x="-37" y="129" width="74" height="9" rx="2" fill="var(--p)"/>
        <path d="M-22 138 L0 166 L22 138 Z" fill="url(#gold)"/>
        <circle cx="0" cy="173" r="5" fill="var(--p)"/>
      </g></g>`;
  }

  const DECO = {
    mihrab: () => svg(DEFS + `
      <path d="M460 1080 V470 C460 300 700 175 960 72 C1220 175 1460 300 1460 470 V1080" fill="url(#archFill)" stroke="var(--p)" stroke-width="4"/>
      <path d="M476 1080 V472 C476 310 710 190 960 90 C1210 190 1444 310 1444 472 V1080" fill="none" stroke="var(--p-a35)" stroke-width="1.5"/>
      <path d="M500 1080 V478 C500 322 722 210 960 118 C1198 210 1420 322 1420 478 V1080" fill="none" stroke="var(--p-a55)" stroke-width="2" stroke-dasharray="3 12" stroke-linecap="round"/>
      <circle cx="960" cy="56" r="13" fill="none" stroke="var(--p)" stroke-width="3"/>
      ${star8(960, 56, 22, 'fill="var(--p)"')}`),
    lanterns: () => svg(DEFS + stars(70) + FRAME + lantern(150, 80, 1.35) + lantern(430, 20, 1.0, 'b') + lantern(1490, 20, 1.0, 'b') + lantern(1770, 80, 1.35)),
    star: () => svg(DEFS + stars(60) + FRAME + `
      ${star8(960, 540, 640, 'class="pt-spin" fill="none" stroke="var(--p-a55)" stroke-width="2.5"')}
      ${star8(960, 540, 580, 'class="pt-spin" fill="none" stroke="var(--p-a15)" stroke-width="1.5"')}`),
    mosque: () => svg(DEFS + stars(55) + FRAME + `
      <circle class="pt-glow" cx="250" cy="200" r="190" fill="url(#halo)"/>
      ${crescent(250, 200, 95)}${star8(312, 168, 22, 'fill="var(--p-hi)"')}
      <g transform="translate(384 412) scale(.6)"><g fill="url(#gold)" opacity=".92">
        <path d="M780 1030 V900 H795 C795 770 900 712 960 650 C1020 712 1125 770 1125 900 H1140 V1030 Z"/>
        <path d="M960 650 V605" stroke="var(--p)" stroke-width="5"/>${crescent(966, 586, 15)}
        <rect x="600" y="960" width="180" height="70"/><rect x="1140" y="960" width="180" height="70"/>
        <path d="M620 962 A70 70 0 0 1 760 962 Z M1160 962 A70 70 0 0 1 1300 962 Z"/>
        <path d="M543 1030 V770 L560 726 L577 770 V1030 Z M1343 1030 V770 L1360 726 L1377 770 V1030 Z"/>
        <rect x="537" y="840" width="46" height="10"/><rect x="1337" y="840" width="46" height="10"/>
        <path d="M268 1030 V860 L282 826 L296 860 V1030 Z M1624 1030 V860 L1638 826 L1652 860 V1030 Z"/>
        <path d="M330 1032 A60 60 0 0 1 450 1032 Z M1470 1032 A60 60 0 0 1 1590 1032 Z"/>
      </g>
      <g fill="rgba(0,0,0,.4)"><path d="M890 1030 V975 A18 18 0 0 1 926 975 V1030 Z M942 1030 V965 A18 18 0 0 1 978 965 V1030 Z M994 1030 V975 A18 18 0 0 1 1030 975 V1030 Z M672 1030 V995 A10 10 0 0 1 692 995 V1030 Z M1228 1030 V995 A10 10 0 0 1 1248 995 V1030 Z"/></g></g>
      <rect x="40" y="1028" width="1840" height="12" fill="var(--p)"/>`),
    pattern: () => svg(DEFS + `<defs><pattern id="tile" width="160" height="160" patternUnits="userSpaceOnUse">
        ${star8(80, 80, 70, 'fill="none" stroke="var(--p)" stroke-width="1.5"')}
        <path d="M0 80 H45 M115 80 H160 M80 0 V45 M80 115 V160" stroke="var(--p)" stroke-width="1.5"/>
        <circle cx="0" cy="0" r="10" fill="none" stroke="var(--p)" stroke-width="1.5"/><circle cx="160" cy="160" r="10" fill="none" stroke="var(--p)" stroke-width="1.5"/>
        <circle cx="160" cy="0" r="10" fill="none" stroke="var(--p)" stroke-width="1.5"/><circle cx="0" cy="160" r="10" fill="none" stroke="var(--p)" stroke-width="1.5"/>
      </pattern></defs>
      <rect x="56" y="56" width="1808" height="968" fill="url(#tile)" opacity=".11"/>` + stars(40) + FRAME),
    simple: () => '',
  };

  const MOON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.5 2.5a9.5 9.5 0 1 0 7 15.9A8 8 0 0 1 14.5 2.5z"/><path fill="currentColor" d="m18.6 5.2.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>';
  const T = {
    ar: { prayer: (n) => `صلاة ${n}`, after: (n) => `${n} بعد` },
    en: { prayer: (n) => `${n} Prayer`, after: (n) => `${n} in` },
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function build() {
    const theme = P.get('theme') || cfg.theme;
    stage.className = 'pt th-' + theme + (cfg.background ? ' has-bg bg-' + cfg.bgMode : '');
    stage.style.setProperty('--tf', `'${cfg.titleFont}'`);
    stage.style.setProperty('--bf', `'${cfg.bodyFont}'`);
    colors(cfg.color, cfg.textColor, cfg.activeColor || window.PrayTimes.autoActive(cfg.color));
    loc = window.PrayerData.find(cfg.country, cfg.city);
    const deco = el('div', 'pt-deco');
    deco.innerHTML = (DECO[theme] || DECO.simple)();
    const c = el('div', 'pt-content pt-in');
    const moon = el('div', 'pt-moon'); moon.innerHTML = MOON;
    // ثيم «مسجد وهلال» فيه هلال كبير في الزاوية — ما نكرره فوق العنوان
    if (theme !== 'mosque') c.append(moon);
    const title = el('h1', 'pt-title', cfg.title);
    title.style.fontSize = cfg.titleSize + 'px';
    c.append(title);
    refs = {};
    if (cfg.show.current) {
      refs.nowName = el('b');
      refs.nowPill = el('span', 'pt-pill');
      const row = el('div', 'pt-now'); row.append(refs.nowName, refs.nowPill); c.append(row);
    }
    if (cfg.show.message && cfg.message) c.append(el('div', 'pt-msg', cfg.message));
    const div = el('div', 'pt-div'); div.append(el('i'), el('u'), el('i')); c.append(div);
    if (cfg.show.times) {
      refs.cards = {};
      const row = el('div', 'pt-cards');
      for (const k of window.PrayTimes.ORDER) {
        const card = el('div', 'pt-card');
        const name = el('span', '', window.PrayTimes.NAMES[cfg.lang][k]);
        const t = el('b');
        card.append(name, t);
        refs.cards[k] = { card, t };
        row.append(card);
      }
      c.append(row);
    }
    if (cfg.show.countdown) {
      refs.cdName = el('span'); refs.cdTime = el('b');
      const cd = el('div', 'pt-cd'); cd.append(refs.cdName, refs.cdTime); c.append(cd);
    }
    if (cfg.show.city || cfg.show.hijri) {
      const f = el('div', 'pt-foot');
      if (cfg.show.city) f.append(el('span', 'pt-city', cfg.lang === 'en' ? loc.city.en : loc.city.ar));
      if (cfg.show.city && cfg.show.hijri) f.append(el('i'));
      if (cfg.show.hijri) { refs.hijri = el('span'); f.append(refs.hijri); }
      c.append(f);
    }
    stage.replaceChildren(...background(), deco, c);
    fit();
    fitTitle(title);
    tick();
  }

  // طبقات الخلفية: «شاشة كاملة» تغطي البث، و«تغميق البث» يغمّقه ويخليه يبان، + ألوان متحركة ورا الذهبي
  function background() {
    if (!cfg.background) return [];
    const out = [];
    const bg = el('div', 'pt-bg');
    const c = cfg.bgColor;
    bg.style.background = cfg.bgMode === 'dim'
      ? `radial-gradient(ellipse 75% 70% at 50% 50%, ${rgba(c, 0.55)}, ${rgba(c, 0.92)})`
      : `radial-gradient(1300px 850px at 50% 42%, ${mix(c, '#ffffff', 0.07)}, ${c} 72%)`;
    bg.style.opacity = String(cfg.bgOpacity / 100);
    out.push(bg);
    if (cfg.bgAnimate) {
      const a = el('div', 'pt-aurora');
      a.style.setProperty('--spd', cfg.bgSpeed + 's');
      a.append(el('i'), el('i'), el('i'));
      out.push(a);
    }
    return out;
  }

  // وقت مع ص/م (أو AM/PM) — ص/م بخط أصغر
  function timeNode(target, date) {
    const f = window.PrayTimes.fmt(date, loc.city.tz, cfg.h12, cfg.lang);
    target.textContent = f.time;
    if (f.ampm) { const s = el('small', '', f.ampm); target.append(s); }
  }

  function tick() {
    if (!cfg || !loc) return;
    const n = now();
    const st = window.PrayTimes.state(loc, cfg.offsets, n, cfg.official && cfg.official.days);
    const names = window.PrayTimes.NAMES[cfg.lang];
    // حان وقت الصلاة: من الأذان لين تخلص المدة اللي حددها المستخدم
    const since = n - st.currentAt;
    const active = since >= 0 && since < cfg.activeMinutes * 60000;
    if (refs.nowName) { refs.nowName.textContent = T[cfg.lang].prayer(names[st.current]); timeNode(refs.nowPill, st.currentAt); refs.nowName.parentElement.classList.toggle('active', active); }
    if (refs.cards) for (const k of window.PrayTimes.ORDER) {
      timeNode(refs.cards[k].t, st.times[k]);
      refs.cards[k].card.classList.toggle('now', active && k === st.current);
      refs.cards[k].card.classList.toggle('next', k === st.next);
    }
    if (refs.cdName) { refs.cdName.textContent = T[cfg.lang].after(names[st.next]); refs.cdTime.textContent = window.PrayTimes.countdown(st.remainingMs); }
    if (refs.hijri) refs.hijri.textContent = window.PrayTimes.hijri(n, loc.city.tz, cfg.lang);
  }

  // العنوان الكبير: الخطوط العربية المزخرفة (مثل الرقعة) ترسم حروفها برا صندوق النص — فوق وتحت —
  // فنقيس «حبر» الحروف الفعلي ونحجز له مكانه بالضبط حتى ما يركب على اللي فوقه أو تحته، ويصغر لو ما يتسع بسطر واحد
  function fitTitle(t) {
    t.style.fontSize = cfg.titleSize + 'px';
    t.style.paddingTop = t.style.paddingBottom = '0px';
    const s = stage.getBoundingClientRect().width / 1920 || 1;
    // نقارن عرض النص نفسه (بدون الحشوة الجانبية) بالمساحة المتاحة، ثم ننزل خطوة خطوة للتأكد
    const pad = parseFloat(getComputedStyle(t).paddingLeft) + parseFloat(getComputedStyle(t).paddingRight);
    let size = cfg.titleSize;
    if (t.scrollWidth > t.clientWidth) {
      size = Math.max(40, Math.floor(cfg.titleSize * (t.clientWidth - pad) / (t.scrollWidth - pad)));
      t.style.fontSize = size + 'px';
      while (t.scrollWidth > t.clientWidth && size > 40) { size -= 2; t.style.fontSize = size + 'px'; }
    }
    const cs = getComputedStyle(t);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    const m = ctx.measureText(t.textContent);
    if (!m.actualBoundingBoxAscent && !m.actualBoundingBoxDescent) return; // متصفح قديم بدون قياس الحبر
    // خط الأساس داخل صندوق العنوان
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    t.append(probe);
    const box = t.getBoundingClientRect();
    const base = (probe.getBoundingClientRect().top - box.top) / s;
    probe.remove();
    const gap = Math.round(size * 0.05) + 6;
    t.style.paddingTop = Math.max(0, m.actualBoundingBoxAscent - base + gap) + 'px';
    t.style.paddingBottom = Math.max(0, base + m.actualBoundingBoxDescent - box.height / s + gap) + 'px';
  }

  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);

  function apply(c) {
    if (!c) return;
    cfg = c;
    // ننتظر الخطوط قبل الرسم حتى ما يطلع العنوان بخط احتياطي ثم يتغيّر
    const fonts = [`700 40px '${cfg.titleFont}'`, `400 40px '${cfg.titleFont}'`, `600 40px '${cfg.bodyFont}'`, `700 40px '${cfg.bodyFont}'`];
    Promise.all(fonts.map((f) => document.fonts.load(f, 'وقت الصلاة').catch(() => null))).then(build, build);
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  Overlay.on('snapshot', (s) => apply(s.prayer)).on('prayer-config', apply);
})();
