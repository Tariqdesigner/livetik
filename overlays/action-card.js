// بطاقة الداعم: تُعرض فوق فيديو/حركة الإجراء. ملف مشترك بين صفحة الأوفرلاي ومحرر الإجراءات في البرنامج.
// ActionCard.render(card, vars, frame) => عنصر جاهز للإضافة إلى الصفحة
(function () {
  const DESIGNS = [
    { id: 'glass', name: 'زجاجي' },
    { id: 'minimal', name: 'بسيط' },
    { id: 'stack', name: 'عمودي' },
    { id: 'ribbon', name: 'شريط' },
    { id: 'gold', name: 'ذهبي' },
    { id: 'pill', name: 'كبسولة' },
    { id: 'neon', name: 'نيون' },
    { id: 'flame', name: 'لهب' },
    { id: 'holo', name: 'هولوغرام' },
    { id: 'comic', name: 'كوميك' },
    { id: 'cyber', name: 'سايبر' },
    { id: 'royal', name: 'ملكي' },
    { id: 'ticket', name: 'تذكرة' },
    { id: 'counter', name: 'عدّاد' },
  ];
  const ANIMS = [
    { id: 'pop', name: 'ظهور مرن' },
    { id: 'drop', name: 'سقوط' },
    { id: 'rise', name: 'صعود' },
    { id: 'slide', name: 'انزلاق' },
    { id: 'zoom', name: 'تكبير' },
    { id: 'fade', name: 'تلاشي' },
    { id: 'bounce', name: 'ارتداد' },
    { id: 'flip', name: 'قلب' },
    { id: 'float', name: 'طفو', loop: true },
    { id: 'pulse', name: 'نبض', loop: true },
    { id: 'heartbeat', name: 'دقة قلب', loop: true },
  ];
  const NAME_ANIMS = [
    { id: 'none', name: 'بدون' },
    { id: 'glow', name: 'توهج' },
    { id: 'shine', name: 'لمعان' },
    { id: 'rainbow', name: 'قوس قزح' },
    { id: 'gradient', name: 'تدرّج' },
    { id: 'wave', name: 'تمايل' },
    { id: 'bounce', name: 'قفز' },
    { id: 'pulse', name: 'نبض' },
    { id: 'flicker', name: 'وميض نيون' },
    { id: 'type', name: 'كتابة' },
    { id: 'shake', name: 'اهتزاز' },
    { id: 'sparkle', name: 'تلألؤ' },
  ];
  // إطارات CSS خفيفة، والإطارات المرسومة تأتي من قائمة إطارات التركيبات (frames/*.webp)
  const CSS_FRAMES = [
    { id: 'none', name: 'بدون' },
    { id: 'ring', name: 'حلقة' },
    { id: 'spin', name: 'حلقة دوّارة' },
    { id: 'double', name: 'حلقتان' },
    { id: 'dash', name: 'متقطعة' },
  ];
  const DEFAULT_CARD = {
    enabled: true, design: 'glass', size: 100, frame: 'ring', crown: false, position: 'top',
    anim: 'pop', nameAnim: 'glow', font: 'Changa', color: '#ffffff', accent: '#3fc5d9',
    template: 'شكراً على {gift}!', showAvatar: true, showGift: true,
  };

  const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2d36"/><circle cx="32" cy="25" r="12" fill="#5d6170"/><path d="M10 60a22 22 0 0 1 44 0z" fill="#5d6170"/></svg>');
  const GIFT_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="2" fill="#ff4d7d"/><rect x="2" y="7" width="20" height="4" rx="1.2" fill="#ff7aa0"/><path d="M11 7h2v14h-2z" fill="#ffd34d"/><path d="M12 7S9.8 2.6 7.6 3.3 6.4 6.6 12 7zm0 0s2.2-4.4 4.4-3.7S17.6 6.6 12 7z" fill="#ffd34d"/></svg>');
  const CROWN = '<svg viewBox="0 0 64 44"><defs><linearGradient id="acg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#e09a10"/></linearGradient></defs><path d="M4 14l14 12L32 4l14 22 14-12-6 26H10z" fill="url(#acg)" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="4" r="3.5" fill="#ff4d6d"/><circle cx="4" cy="14" r="3" fill="#4dd2ff"/><circle cx="60" cy="14" r="3" fill="#4dd2ff"/><rect x="10" y="36" width="44" height="5" rx="2" fill="#c98200"/></svg>';

  const h = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };
  const img = (src, cls, fallback) => {
    const i = h('img', cls);
    i.referrerPolicy = 'no-referrer';
    i.alt = '';
    i.src = src || fallback;
    i.onerror = () => { i.onerror = null; i.src = fallback; };
    return i;
  };

  // تحميل خط Google عند الحاجة (مرة واحدة لكل خط)
  const loaded = new Set();
  function loadFont(name, fonts) {
    if (!name || loaded.has(name)) return;
    loaded.add(name);
    const all = fonts ? { ...(fonts.arabic || {}), ...(fonts.latin || {}) } : {};
    const axes = all[name];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}${axes ? ':' + axes : ''}&display=swap`;
    document.head.append(link);
  }

  function fill(tpl, v) {
    return String(tpl == null ? '' : tpl)
      .replace(/\{name\}|\{user\}/g, v.name || '')
      .replace(/\{coins\}/g, String(v.coins || 0))
      .replace(/\{count\}/g, String(v.count || 1))
      .replace(/\{gift\}/g, v.giftName || '')
      .replace(/\{comment\}/g, v.comment || '');
  }

  function avatarEl(c, v, frame, base) {
    const wrap = h('div', 'ac-pic');
    const pic = h('div', 'pic');
    pic.append(img(v.avatar, 'av', SILHOUETTE));
    const fid = c.frame || 'none';
    if (frame && frame.w && window.FrameFX) {
      // إطار مرسوم بمؤثراته: نفس طريقة التركيبات (الصورة تصغر داخل فتحة الإطار)
      wrap.classList.add('has-frame');
      pic.style.setProperty('--af', window.FrameFX.fit(frame));
      if (frame.under) pic.classList.add('fr-under');
      pic.append(window.FrameFX.build(frame, base));
      // الإطارات العريضة (أجنحة) تحتاج مساحة حول الصورة حتى لا تغطي الاسم
      const ext = (n) => Math.max(0, ((n / (2 * frame.outer)) * 1.18 - 1) / 2 * 3.1 - 0.25);
      wrap.style.margin = `${ext(frame.h * 0.8).toFixed(2)}em ${ext(frame.w).toFixed(2)}em`;
    } else {
      wrap.classList.add('acf-' + fid);
    }
    wrap.append(pic);
    if (c.crown) {
      const cr = h('div', 'ac-crown');
      cr.innerHTML = CROWN;
      wrap.append(cr);
    }
    return wrap;
  }

  function render(card, vars, frame, opts) {
    const c = { ...DEFAULT_CARD, ...(card || {}) };
    const v = vars || {};
    const o = opts || {};
    // داخل البرنامج تمنع سياسة الأمان خطوط Google، فالمعاينات المصغّرة تستخدم الخط المحلي
    if (!o.noFonts) loadFont(c.font, o.fonts);
    const wrap = h('div', 'ac-wrap pos-' + (c.position || 'top'));
    wrap.style.setProperty('--s', Math.max(0.3, Math.min(4, (Number(c.size) || 100) / 100)));
    wrap.style.setProperty('--tc', c.color || '#fff');
    wrap.style.setProperty('--a', c.accent || '#3fc5d9');
    if (c.font) wrap.style.setProperty('--ff', `"${c.font}"`);

    const anim = ANIMS.find((a) => a.id === c.anim) || ANIMS[0];
    const box = h('div', `ac ac-${c.design || 'glass'} an-${anim.id}${anim.loop ? ' an-loop' : ''}`);
    if (c.showAvatar !== false) box.append(avatarEl(c, v, frame, o.base));

    const txt = h('div', 'ac-txt');
    const name = h('div', 'ac-name nm-' + (c.nameAnim || 'none'), v.name || '');
    name.dataset.text = v.name || '';
    txt.append(name);
    const msg = fill(c.template, v);
    if (msg) txt.append(h('div', 'ac-msg', msg));
    if (c.design === 'counter') txt.prepend(h('div', 'ac-big', '×' + (v.count || 1)));
    box.append(txt);

    if (c.showGift !== false && (v.giftImage || v.giftName)) box.append(img(v.giftImage, 'ac-gift', GIFT_SVG));
    if (c.design === 'ticket') box.append(h('i', 'ac-notch'));
    if (c.design === 'cyber') box.append(h('i', 'ac-scan'));
    wrap.append(box);
    return wrap;
  }

  // خروج البطاقة بنعومة قبل إزالتها
  function hide(el) {
    if (!el) return;
    el.classList.add('ac-out');
    setTimeout(() => el.remove(), 450);
  }

  window.ActionCard = { DESIGNS, ANIMS, NAME_ANIMS, CSS_FRAMES, DEFAULT_CARD, render, hide, fill, loadFont };
})();
