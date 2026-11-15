// بناء إطار صورة الحساب مع مؤثراته. مشترك بين التركيبات (widget.js) وبطاقة الداعم (action-card.js) ومعاينات البرنامج.
// FrameFX.build(frame, base) => عنصر .fr يوضع داخل .pic ، FrameFX.fit(frame) => نسبة تصغير الصورة داخل الفتحة
(function () {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const pct = (v) => (v * 100).toFixed(3) + '%';

  function build(f, base) {
    const fx = f.fx || {};
    const cls = ['fr', 'fr-' + f.id];
    if (f.sprite) cls.push('fr-sprite');
    if (f.draw) cls.push('fr-draw');
    if (fx.wings) cls.push('fr-wings');
    if (fx.enter) cls.push('fr-enter');
    if (fx.spin) cls.push('fr-spin');
    if (fx.flicker) cls.push('fr-flicker');
    const fr = h('div', cls.join(' '));
    // الحلقة كلها تبقى في مكان الصورة الأصلي (مع تجاوز بسيط)، والصورة تصغر لتملأ فتحتها فقط
    const FIT = 1.18;
    const wPct = (f.w / (2 * f.outer)) * 100 * FIT;
    const s = fr.style;
    s.width = wPct + '%';
    s.aspectRatio = `${f.w} / ${f.h}`;
    s.left = 50 - (f.cx / f.w) * wPct + '%';
    s.top = 50 - (f.cy / f.w) * wPct + '%';
    // file = مسار مخصص داخل frames (مثل إطارات الدسكورد المتحركة APNG)، وإلا <id>.webp
    const defBase = !base && window.Overlay && !window.Overlay.isLocal ? window.Overlay.localOrigin + '/overlay/' : '';
    s.setProperty('--img', `url("${base || defBase}frames/${f.file || f.id + '.webp'}")`);
    s.setProperty('--ox', pct(f.cx / f.w));
    s.setProperty('--oy', pct(f.cy / f.h));
    // نصف قطر الحلقة كنسبة من العرض/الارتفاع (للأقنعة والهالة)
    s.setProperty('--rx', pct((f.outer * 1.03) / f.w));
    s.setProperty('--ry', pct((f.outer * 1.03) / f.h));
    if (f.sprite) { const n = f.n || 8; s.setProperty('--n', n); s.setProperty('--ty', f.dur + 's'); s.setProperty('--tx', f.dur / n + 's'); }
    if (fx.pulse) s.setProperty('--pc', fx.pulse);
    if (fx.spin) s.setProperty('--sd', fx.spin + 's');

    // هالة دوّارة خلف الإطار
    if (fx.aura) {
      const au = h('i', 'au');
      au.style.setProperty('--c1', fx.aura[0]);
      au.style.setProperty('--c2', fx.aura[1]);
      fr.append(au);
    }
    fr.append(h('i', 'fa'), h('i', 'fb'));

    // الأجنحة: نسختان من الصورة مقصوصتان (يسار/يمين خارج الحلقة) ترفرفان حول الكتف
    if (fx.wings) {
      const w = fx.wings;
      s.setProperty('--wl', pct(w.l));
      s.setProperty('--wr', pct(w.r));
      s.setProperty('--wy', pct(w.y || 1));
      for (const side of ['wl', 'wr']) {
        const e = h('i', 'wg ' + side);
        const px = side === 'wl' ? w.px : 1 - w.px;
        e.style.transformOrigin = `${pct(px)} ${pct(w.py)}`;
        e.style.setProperty('--deg', (w.deg || 6) + 'deg');
        e.style.setProperty('--wd', (w.dur || 2.8) + 's');
        fr.append(e);
      }
    }
    // لمعة تمر على الأجزاء المعدنية/الذهبية فقط (القناع = صورة الإطار)
    if (fx.glint) {
      const gl = h('i', 'gl');
      gl.style.setProperty('--gc', fx.glint);
      gl.style.setProperty('--gd', (fx.glintDur || 4.5) + 's');
      fr.append(gl);
    }
    // ومضة برق: نسخة مضيئة تظهر وتختفي بشكل غير منتظم
    if (fx.lightning) {
      const lt = h('i', 'lt');
      lt.style.setProperty('--lc', fx.lightning);
      fr.append(lt);
    }
    // نجوم تتلألأ في مواضع البريق المرسومة في التصميم
    for (const [x, y, sz] of fx.twinkle || []) {
      const b = h('b', 'tw');
      b.style.cssText = `--x:${pct(x)};--y:${pct(y)};--sz:${sz || 1};--de:-${rnd(0, 3).toFixed(2)}s;--du:${rnd(2.2, 3.6).toFixed(2)}s;--tc:${fx.twinkleColor || '#fff'}`;
      fr.append(b);
    }
    // عيون تتوهج
    for (const [x, y] of fx.eyes || []) {
      const b = h('b', 'eye');
      b.style.cssText = `--x:${pct(x)};--y:${pct(y)};--ec:${fx.eyeColor || '#c77dff'}`;
      fr.append(b);
    }
    // جمر يتصاعد من أسفل الحلقة
    if (fx.embers) {
      for (let i = 0; i < 16; i++) {
        const b = h('b', 'em');
        const ang = rnd(-80, 260) * (Math.PI / 180);
        const rr = rnd(0.85, 1.25);
        const x = f.cx / f.w + (Math.cos(ang) * f.outer * rr) / f.w;
        const y = f.cy / f.h + (Math.sin(ang) * f.outer * rr) / f.h;
        b.style.cssText = `--x:${pct(x)};--y:${pct(y)};--du:${rnd(1.6, 3.2).toFixed(2)}s;--de:-${rnd(0, 3.2).toFixed(2)}s;--dx:${rnd(-14, 14).toFixed(0)}%;--es:${rnd(0.6, 1.4).toFixed(2)};--ec:${fx.embers}`;
        fr.append(b);
      }
    }
    // ثلج يتساقط حول الإطار
    if (fx.snow) {
      for (let i = 0; i < 18; i++) {
        const b = h('b', 'sn');
        b.style.cssText = `--x:${rnd(4, 96).toFixed(1)}%;--y:${rnd(-4, 30).toFixed(1)}%;--du:${rnd(3, 6).toFixed(2)}s;--de:-${rnd(0, 6).toFixed(2)}s;--dx:${rnd(-30, 30).toFixed(0)}%;--es:${rnd(0.5, 1.3).toFixed(2)};--ec:${fx.snow}`;
        fr.append(b);
      }
    }
    if (f.id === 'red-drip') {
      // قطرات تسقط من مواضع السيلان في الصورة
      for (const [l, t, du, de, c] of [[49.5, 62, '2.6s', '0s', '#111'], [47, 55, '3.1s', '-1.1s', '#e0101f'], [52, 56, '2.2s', '-1.7s', '#e0101f'], [60, 50, '3.5s', '-.6s', '#e0101f'], [33, 50, '3.8s', '-2.4s', '#111']]) {
        const b = h('b');
        b.style.cssText = `--l:${l}%;--t:${t}%;--du:${du};--de:${de};--dc:${c}`;
        fr.append(b);
      }
    }
    if (f.sparks) {
      for (let i = 0; i < 12; i++) {
        const b = h('b', 'sp');
        const r0 = 44 * rnd(0.82, 1);
        b.style.cssText = `--an:${rnd(0, 360).toFixed(0)}deg;--r0:${r0}cqw;--r1:${r0 + rnd(5, 12)}cqw;--du:${rnd(1.1, 2.4).toFixed(2)}s;--de:-${rnd(0, 2.4).toFixed(2)}s;--spc:${f.sparks}`;
        fr.append(b);
      }
      fr.style.containerType = 'inline-size';
    }
    return fr;
  }

  const fit = (f) => Math.min(1, (f.hole / f.outer) * 1.18).toFixed(3);

  window.FrameFX = { build, fit };
})();
