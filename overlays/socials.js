// بنرات حسابات التواصل: تُرسم حسب الثيم المختار مع حركات دخول/خروج وحركات مستمرة
// ?theme=..  يفرض ثيماً (للمعاينة)   ?mode=stack|cycle   ?scale=..
(function () {
  const P = new URLSearchParams(location.search);
  const stage = document.getElementById('stage');
  let cfg = null;
  let platforms = {};
  let timers = [];

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function platformOf(item) {
    const p = platforms[item.platform] || platforms.custom || { name: 'Link', c: '#a78bfa', c2: '#c4b5fd', ct: '#111', cta: 'FOLLOW ME', action: 'follow', icon: '' };
    if (item.platform !== 'custom') return p;
    // منصة مخصصة: اسم ولون يحددهما المستخدم
    const c = item.color || p.c;
    return { ...p, name: item.name || 'Link', c, c2: item.color2 || c, cta: 'FOLLOW ME ON ' + String(item.name || '').toUpperCase() };
  }

  const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));

  // زخارف ثيم «كيوت»: أشكال مبسطة بدون وجوه
  const CLOUD = '<svg viewBox="0 0 64 40"><path fill="#fff" d="M14 38C6 38 2 33 2 27.5S6.5 18 12 18c1-8 7.5-14 15.5-14 6.5 0 12 4 14.4 9.6C43.5 12.6 45 12 47 12c6 0 11 4.8 11 11 4 1 6 4.4 6 7.5 0 4.2-3.3 7.5-7.5 7.5z"/></svg>';
  const SPARK = '<svg viewBox="0 0 24 24"><path fill="#ffd34d" d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z"/></svg>';
  const HEART = '<svg viewBox="0 0 24 24"><path fill="#ff5c8a" d="M12 20.5s-7.6-4.5-9.6-9.1C1.1 8.3 3.2 4.8 6.7 4.8c2 0 3.6 1.1 4.3 2.6h2c.7-1.5 2.3-2.6 4.3-2.6 3.5 0 5.6 3.5 4.3 6.6-2 4.6-9.6 9.1-9.6 9.1z"/></svg>';

  function caption(theme, item, p) {
    let c = item.caption || (theme === 'neon' || theme === 'glow' ? p.cta : p.name.toUpperCase());
    // ديسكورد: عدد أعضاء السيرفر بجانب النص الصغير
    if (item.platform === 'discord' && item.showMembers && item.members) c += ` • ${compact(item.members)} MEMBERS`;
    return c;
  }

  function build(item, i, theme) {
    const p = platformOf(item);
    const wrap = document.createElement('div');
    wrap.className = 'sb-wrap';
    wrap.style.setProperty('--i', i);
    const handle = String(item.handle || '');
    const at = handle.startsWith('@');
    const handleHtml = (theme === 'soft' || theme === 'ring') && at ? `<span class="at">@</span>${esc(handle.slice(1))}` : esc(handle);
    const glyph = `<svg viewBox="0 0 24 24" fill="currentColor">${p.icon}</svg>`;
    // زخارف حسب الثيم (المعرّفات ثابتة للتوافق مع الإعدادات المحفوظة)
    let deco = '';
    let icoExtra = '';
    let barDeco = '';
    if (theme === 'esports' || theme === 'pill' || theme === 'tilt') barDeco = '<i class="shine"></i>';
    if (theme === 'street') barDeco = '<i class="uline"></i>';
    // الثيمات الكلاسيكية المحسّنة
    if (theme === 'arena') barDeco = '<i class="tick t1"></i><i class="tick t2"></i><i class="shine"></i>';
    if (theme === 'hexwide') barDeco = '<i class="strip s1"></i><i class="strip s2"></i>';
    if (theme === 'ring') icoExtra = '<i class="ring"></i><i class="arc"></i>';
    if (theme === 'cute') {
      deco = `<i class="cloud">${CLOUD}</i><i class="star">${SPARK}</i><i class="dots"><b></b><b></b><b></b></i>`;
      icoExtra = `<i class="heart">${HEART}</i>`;
    }
    wrap.innerHTML = `
      <div class="sb p-${esc(item.platform)}" style="--c:${p.c};--c2:${p.c2};--ct:${p.ct}">
        <div class="sb-ico">${icoExtra}<div class="sb-glyph">${glyph}</div></div>
        <div class="sb-bar">
          <span class="sb-cap">${esc(caption(theme, item, p))}</span>
          <span class="sb-handle" dir="auto">${handleHtml}</span>
          <span class="sb-btn">${esc(p.action)}</span>
          ${barDeco}
        </div>
        ${deco}
      </div>`;
    return wrap;
  }

  function visibleItems() {
    let items = (cfg.items || []).filter((x) => x.enabled !== false && String(x.handle || '').trim());
    if (!items.length && P.get('preview') === '1') {
      items = [
        { platform: 'tiktok', handle: '@username' },
        { platform: 'youtube', handle: 'Channel Name' },
        { platform: 'instagram', handle: '@username' },
      ];
    }
    return items;
  }

  // ================= طرق العرض =================
  // تناوب (بنر واحد في نفس المكان): كل طريقة لها حركة دخول وخروج على .slot
  const ROTATE = ['cycle', 'timed', 'slide', 'flip', 'cube', 'zoom', 'drop', 'swing', 'random'];
  const RANDOM_POOL = ['slide', 'flip', 'cube', 'zoom', 'drop', 'swing'];
  // مواقع (الكل موجود ويتحرك لمكانه): المقدمة واضحة والباقي في الخلف
  const POSITIONAL = ['wheel', 'coverflow', 'deck'];

  const holdMs = () => Math.max(2, Number(cfg.hold) || 6) * 1000;
  // مدة البنر: مدته الخاصة إن حُددت، وإلا المدة العامة
  const durOf = (item) => (Number(item.dur) > 0 ? Number(item.dur) * 1000 : holdMs());

  // إعادة حركة الثيم الداخلية لبنر (أيقونة/شريط) عند وصوله للمقدمة
  function replayInner(wrap) {
    wrap.classList.remove('in');
    void wrap.offsetWidth;
    wrap.style.setProperty('--i', 0);
    wrap.classList.add('in');
  }

  function slotOf(item, i, theme) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.append(build(item, i, theme));
    return slot;
  }

  function render() {
    if (!cfg) return;
    clearTimers();
    const theme = P.get('theme') || cfg.theme || 'neon';
    const mode = P.get('mode') || cfg.mode || 'stack';
    const scale = Number(P.get('scale') || cfg.scale || 100) / 100;
    stage.className = 'stage t-' + theme + ' m-' + mode;
    stage.style.setProperty('--scale', scale);
    stage.replaceChildren();
    const items = visibleItems();
    if (!items.length) return;

    if (ROTATE.includes(mode)) return runRotate(items, theme, mode);
    if (POSITIONAL.includes(mode)) return runPositional(items, theme, mode);
    if (mode === 'ticker' || mode === 'marquee') return runScroller(items, theme, mode);
    if (mode === 'spotlight' || mode === 'wave') return runHighlight(items, theme, mode);
    return runStack(items, theme);
  }

  // 1) الكل معاً: دخول متتابع ثم إعادة الحركة كل replay ثانية
  function runStack(items, theme) {
    const show = () => {
      const nodes = items.map((it, i) => build(it, i, theme));
      if (theme === 'cute') {
        // أسهم صغيرة بين البطاقات
        const withChev = [];
        nodes.forEach((n, i) => { withChev.push(n); if (i < nodes.length - 1) { const c = document.createElement('i'); c.className = 'chev'; c.style.setProperty('--i', i + 0.5); withChev.push(c); } });
        stage.replaceChildren(...withChev);
      } else stage.replaceChildren(...nodes);
      requestAnimationFrame(() => stage.querySelectorAll('.sb-wrap, .chev').forEach((n) => n.classList.add('in')));
      const replay = Number(cfg.replay) || 0;
      if (replay > 0) {
        later(replay * 1000, () => {
          stage.querySelectorAll('.sb-wrap, .chev').forEach((n) => { n.classList.remove('in'); n.classList.add('out'); });
          later(700 + items.length * 120, show);
        });
      }
    };
    show();
  }

  // 2) تناوب في نفس المكان (الدخول والخروج متداخلان)
  function runRotate(items, theme, mode) {
    const box = document.createElement('div');
    box.className = 'rot';
    stage.append(box);
    let k = 0;
    let fx = mode;
    const next = () => {
      const item = items[k % items.length];
      if (mode === 'random') fx = RANDOM_POOL[(Math.random() * RANDOM_POOL.length) | 0];
      const slot = slotOf(item, 0, theme);
      slot.classList.add('fx-' + fx, 'enter');
      box.append(slot);
      requestAnimationFrame(() => slot.querySelector('.sb-wrap').classList.add('in'));
      later(durOf(item, mode), () => {
        const w = slot.querySelector('.sb-wrap');
        slot.classList.remove('enter');
        slot.classList.add('leave');
        if (fx === 'cycle' || fx === 'timed') { w.classList.remove('in'); w.classList.add('out'); }
        later(800, () => slot.remove());
        // "واحد لحاله": الشاشة تبقى فارغة مدة gap قبل البنر التالي
        const gap = mode === 'timed' ? 800 + Math.max(0, Number(cfg.gap) || 0) * 1000 : 0;
        if (gap) later(gap, next);
        else if (items.length === 1) later(900, next);
        else later(fx === 'cycle' ? 450 : 120, next);
        k++;
      });
    };
    next();
  }

  // 3) عجلة / عرض ثلاثي أفقي / بطاقات متراكمة
  function runPositional(items, theme, mode) {
    const box = document.createElement('div');
    box.className = 'pos pos-' + mode;
    stage.append(box);
    const slots = items.map((it, i) => slotOf(it, i, theme));
    box.append(...slots);
    const n = slots.length;
    let k = 0;
    requestAnimationFrame(() => slots.forEach((s) => s.querySelector('.sb-wrap').classList.add('in')));

    const place = (instant) => {
      const h = Math.max(...slots.map((s) => s.offsetHeight)) || 80;
      const w = Math.max(...slots.map((s) => s.offsetWidth)) || 300;
      if (mode === 'wheel') box.style.padding = `${Math.round(h * 0.8)}px 0`;
      if (mode === 'coverflow') box.style.padding = `0 ${Math.round(w * 0.55)}px`;
      if (mode === 'deck') box.style.padding = `${Math.min(n - 1, 3) * Math.round(h * 0.3)}px ${Math.min(n - 1, 3) * 26}px 0 0`;
      slots.forEach((s, i) => {
        let d = (((i - k) % n) + n) % n;
        if (mode !== 'deck' && d > n / 2) d -= n;
        const a = Math.abs(d);
        s.style.transition = instant ? 'none' : '';
        s.classList.toggle('front', d === 0);
        let t = '';
        let o = 1;
        let f = 'none';
        let z = 50 - a;
        if (mode === 'wheel') {
          const y = a > 1 ? Math.sign(d) * h * 1.25 : d * h * 0.78;
          t = `translateY(${y}px) scale(${d === 0 ? 1 : a === 1 ? 0.82 : 0.6})`;
          o = d === 0 ? 1 : a === 1 ? 0.42 : 0;
          f = d === 0 ? 'none' : 'blur(1.2px) saturate(.6) brightness(.8)';
        } else if (mode === 'coverflow') {
          const x = a > 1 ? Math.sign(d) * w * 0.95 : d * w * 0.6;
          t = `translateX(${x}px) rotateY(${-d * 38}deg) scale(${d === 0 ? 1 : 0.78})`;
          o = d === 0 ? 1 : a === 1 ? 0.5 : 0;
          f = d === 0 ? 'none' : 'blur(1px) brightness(.75)';
        } else {
          t = `translate(${d * 26}px, ${-d * Math.round(h * 0.3)}px) scale(${1 - d * 0.08})`;
          o = d > 3 ? 0 : d === 0 ? 1 : 0.62 - (d - 1) * 0.2;
          f = d === 0 ? 'none' : `brightness(${0.75 - d * 0.1}) blur(${d * 0.8}px)`;
          z = 50 - d;
        }
        s.style.transform = t;
        s.style.opacity = o;
        s.style.filter = f;
        s.style.zIndex = z;
      });
    };
    requestAnimationFrame(() => place(true));
    if (n < 2) return;
    const step = () => {
      later(durOf(items[k % n], 'timed'), () => {
        const front = slots[k % n];
        if (mode === 'deck') {
          // البطاقة الأمامية تطير ثم ترجع لآخر المجموعة
          front.classList.add('fly');
          later(520, () => { front.classList.remove('fly'); k = (k + 1) % n; place(); replayInner(slots[k].querySelector('.sb-wrap')); step(); });
          return;
        }
        k = (k + 1) % n;
        place();
        replayInner(slots[k].querySelector('.sb-wrap'));
        step();
      });
    };
    step();
  }

  // 4) تمرير مستمر: عمودي (ticker) أو أفقي (marquee)
  function runScroller(items, theme, mode) {
    const view = document.createElement('div');
    view.className = 'scroller sc-' + mode;
    const track = document.createElement('div');
    track.className = 'track';
    // نسختان متتاليتان حتى يكون التمرير بلا انقطاع
    for (let r = 0; r < 2; r++) items.forEach((it, i) => track.append(slotOf(it, i, theme)));
    view.append(track);
    stage.append(view);
    requestAnimationFrame(() => {
      track.querySelectorAll('.sb-wrap').forEach((w) => { w.style.setProperty('--i', 0); w.classList.add('in'); });
      const secs = Math.max(1.5, (Number(cfg.speed) || 3) * items.length);
      track.style.animationDuration = secs + 's';
      if (mode === 'ticker') {
        const first = track.children[0];
        const h = first.offsetHeight;
        view.style.height = Math.round(Math.min(items.length, 3) * (h + 14)) + 'px';
      }
    });
  }

  // 5) تسليط الضوء أو موجة: الكل ظاهر والنشط يبرز بالدور
  function runHighlight(items, theme, mode) {
    const list = items.map((it, i) => slotOf(it, i, theme));
    stage.append(...list);
    requestAnimationFrame(() => list.forEach((s) => s.querySelector('.sb-wrap').classList.add('in')));
    let k = 0;
    const tick = () => {
      list.forEach((s, i) => {
        s.classList.toggle('lit', i === k);
        s.classList.toggle('dim', mode === 'spotlight' && i !== k);
        s.classList.remove('hop');
      });
      if (mode === 'wave') { void list[k].offsetWidth; list[k].classList.add('hop'); }
      if (mode === 'spotlight') replayInner(list[k].querySelector('.sb-wrap'));
      const wait = mode === 'wave' ? Math.max(500, holdMs() / 4) : durOf(items[k], 'timed');
      later(wait, () => { k = (k + 1) % list.length; tick(); });
    };
    later(900 + items.length * 180, tick);
  }

  function apply(data) {
    if (!data) return;
    if (data.platforms) platforms = Object.fromEntries(data.platforms.map((p) => [p.id, p]));
    if (data.config) cfg = data.config;
    render();
  }

  Overlay.on('snapshot', (s) => apply(s.socials)).on('socials-config', apply);
})();
