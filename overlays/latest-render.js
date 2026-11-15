// رسّام ويدجت «آخر الأحداث» — ملف مشترك بين صفحة الأوفرلاي (OBS) ونافذة الإعدادات في التطبيق (معاينة مطابقة 100%)
// LatestRender.build(cfg, data, { kind, base, frames }) => عنصر جاهز
//   cfg  = إعدادات النوع (src/latestcfg.js)   data = { name, avatar, gift, count, coins }
//   base = مسار مجلد overlays ('' داخل الأوفرلاي، '../overlays/' داخل التطبيق)   frames = قائمة الإطارات المرسومة
(function () {
  const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3550"/><stop offset="1" stop-color="#1c1a28"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="25" r="12" fill="#6d6788"/><path d="M10 62a22 22 0 0 1 44 0z" fill="#6d6788"/></svg>');
  const CSS_FRAMES = ['ring', 'spin', 'double', 'dash'];
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const mix = (a, b, t) => { const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  // النص تحت الاسم: {{gift}} {{count}} {{coins}} — فاضي = النص الافتراضي لكل نوع
  const DEFAULT_SUB = { gift: 'أرسل {{gift}} ×{{count}}', top: '{{coins}} كوينز', like: '×{{count}}' };
  function subText(cfg, kind, d) {
    const tpl = cfg.name.sub || DEFAULT_SUB[kind] || '';
    if (!tpl) return '';
    if (/\{\{gift\}\}/.test(tpl) && !d.gift) return '';
    if (/\{\{count\}\}/.test(tpl) && !d.count) return '';
    if (/\{\{coins\}\}/.test(tpl) && !d.coins) return '';
    return tpl.replace(/\{\{gift\}\}/g, d.gift || '').replace(/\{\{count\}\}/g, Number(d.count || 0).toLocaleString('en-US')).replace(/\{\{coins\}\}/g, Number(d.coins || 0).toLocaleString('en-US'));
  }

  function avatar(cfg, d, base, frames) {
    const fid = cfg.avatar.frame || 'none';
    const frame = (frames || []).find((f) => f.id === fid);
    const wrap = h('div', `lt-pic lt-av-${cfg.avatar.style}`);
    const pic = h('div', 'pic');
    const img = h('img', 'av');
    img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.src = d.avatar || SILHOUETTE;
    img.onerror = () => { img.onerror = null; img.src = SILHOUETTE; };
    pic.append(img);
    if (frame && frame.w && window.FrameFX) {
      // نفس طريقة قسم الإجراءات: الصورة تصغر داخل فتحة الإطار والإطار فوقها
      wrap.classList.add('has-frame');
      pic.style.setProperty('--af', window.FrameFX.fit(frame));
      if (frame.under) pic.classList.add('fr-under');
      pic.append(window.FrameFX.build(frame, base));
    } else if (CSS_FRAMES.includes(fid)) {
      wrap.classList.add('lt-cf-' + fid);
    }
    wrap.append(pic);
    return wrap;
  }

  function title(cfg) {
    const t = cfg.title;
    const el = h('div', `lt-title lt-t-${t.shape}${t.shimmer ? ' lt-shim' : ''}`);
    el.append(h('span', '', t.text));
    el.dataset.text = t.text; // للمعة على الحروف
    el.style.setProperty('--tc', t.color);
    el.style.fontFamily = `'${t.font}', 'Outfit', 'Tajawal', sans-serif`;
    el.style.transform = `translate(${t.dx}px, ${t.dy}px)`;
    return el;
  }

  function build(cfg, d, opts) {
    const o = opts || {};
    const kind = o.kind || 'follow';
    d = d || {};
    const n = cfg.name;
    const root = h('div', `lt lt-side-${cfg.avatar.side}${cfg.motion.animate && o.animate ? ' lt-in lt-a-' + cfg.motion.anim : ''}`);
    // المتغيرات: لون الاسم والتوهج وقوته وحجمه
    const glowPx = (n.glowPower / 100) * 34;
    const vars = {
      '--nc': n.color, '--ng': n.glow, '--ng-a': rgba(n.glow, 0.85), '--n1': n.c1, '--n2': n.c2,
      '--nhi': mix(n.color, '#ffffff', 0.55), '--nlo': mix(n.color, '#000000', 0.45),
      '--glow': glowPx.toFixed(1) + 'px', '--flick': (n.flicker / 100).toFixed(2), '--ns': (n.size / 100).toFixed(2),
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);

    const txt = h('div', 'lt-txt');
    if (cfg.title.show && cfg.title.pos === 'above') txt.append(title(cfg));
    const nm = h('div', `lt-name lt-n-${n.style}${n.shimmer ? ' lt-shim' : ''}${n.stroke ? ' lt-stroke' : ''}${n.flicker > 0 ? ' lt-flick' : ''}`);
    nm.style.fontFamily = `'${n.font}', 'Lalezar', 'Tajawal', sans-serif`;
    const label = d.name || '';
    nm.append(h('span', '', label));
    nm.dataset.text = label; // للطبقة اللامعة/المعدنية
    txt.append(nm);
    const sub = subText(cfg, kind, d);
    if (sub) txt.append(h('div', 'lt-sub', sub));
    if (cfg.title.show && cfg.title.pos === 'below') txt.append(title(cfg));

    if (cfg.avatar.show) root.append(avatar(cfg, d, o.base || '', o.frames));
    root.append(txt);
    return root;
  }

  window.LatestRender = { build, DEFAULT_SUB, SILHOUETTE };
})();
