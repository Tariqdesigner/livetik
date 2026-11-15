// صندوق التنبيهات: يعرض التنبيهات حسب إعدادات المحرر (تخطيط، صورة/فيديو، صوت، حركات، خطوط، كود مخصص)
(function () {
  const { params } = Overlay;
  const stage = document.getElementById('ld-stage');
  const PREVIEW = params.get('preview') === '1';

  // نفس القالب الافتراضي في src/alertbox-defaults.js (يُستخدم عند تعطيل الكود المخصص)
  const BASE_HTML = '<div id="alert-box"><div id="alert-image-wrap"><div id="alert-image">{media}</div></div><div id="alert-text-wrap"><div id="alert-text"><div id="alert-message">{messageTemplate}</div><div id="alert-user-message">{userMessage}</div></div></div></div>';
  const OUT_MS = 800;
  const SAMPLE_USER = { uniqueId: 'livedeck_user', nickname: 'مستخدم تجريبي' };
  // بيانات إضافية للتنبيه التجريبي حسب نوعه
  const SAMPLE_EXTRA = {
    follow: {},
    gift: { giftName: 'Rose', count: 5, amount: 5, giftImage: '' },
    share: {},
    subscribe: {},
  };

  let config = null;
  let fonts = {};
  let live = !PREVIEW; // المعاينة لا تستقبل أحداث البث إلا عند تفعيل "المعاينة المباشرة"
  let muted = false;
  const queue = [];
  let busy = false;
  let timers = [];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function fontHref(name) {
    const axis = fonts[name];
    const fam = encodeURIComponent(name).replace(/%20/g, '+') + (axis ? ':' + axis : '');
    return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
  }

  function loadFont(name) {
    if (!name) return;
    const href = fontHref(name);
    const link = document.getElementById('ld-font');
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }

  // خطوط حقول fontpicker (قد تكون أي خط من Google Fonts)
  const extraFonts = new Set();
  function loadExtraFont(name) {
    name = String(name || '').trim();
    if (!name || extraFonts.has(name)) return;
    extraFonts.add(name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fonts[name] !== undefined ? fontHref(name) : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`;
    document.head.append(link);
  }

  // الاسم العربي يُحرّك كلمة كلمة حتى لا تنفصل الحروف، واللاتيني حرفاً حرفاً
  function nameHtml(name, anim) {
    const arabic = /[؀-ۿ]/.test(name);
    const parts = arabic ? name.split(/(\s+)/) : [...name];
    const inner = parts.map((p, i) => (/^\s+$/.test(p) ? esc(p) : `<span class="ld-ch" style="--i:${i}">${esc(p)}</span>`)).join('');
    // dir يعزل اتجاه الاسم حتى لا تنعكس حروف الأسماء الإنجليزية داخل رسالة عربية
    return `<span class="ld-name${anim && anim !== 'none' ? ' ld-t-' + anim : ''}" dir="${arabic ? 'rtl' : 'ltr'}">${inner}</span>`;
  }

  // صورة الهدية من تيك توك (إن فُعّلت) لها الأولوية على الصورة المحددة
  function imageFor(ev, item) {
    if (item.event === 'gift' && ev.useGiftImage && item.giftImage) return { url: item.giftImage, type: 'image' };
    return { url: ev.image || '', type: ev.imageType };
  }

  function mediaHtml(ev, item) {
    const m = imageFor(ev, item);
    if (!m.url) return '';
    const src = esc(m.url);
    if (m.type === 'video') return `<video src="${src}" autoplay playsinline></video>`;
    return `<img src="${src}" alt="">`;
  }

  // الحقول بصيغة Streamlabs: { key: { type, label, value, ... } } أو صيغة بسيطة { key: value }
  function parseFields(ev) {
    let defs = {};
    try {
      defs = JSON.parse(ev.custom.fields || '{}') || {};
    } catch (_) {}
    const values = {};
    for (const [k, d] of Object.entries(defs)) {
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        if (d.type === 'header') continue;
        values[k] = d.value == null ? '' : d.value;
        if (d.type === 'fontpicker') loadExtraFont(values[k]);
      } else values[k] = d == null ? '' : d;
    }
    return values;
  }

  // استبدال {token} — لكل لغة طريقة تهريب مختلفة
  const jsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, '\\n').replace(/<\/script/gi, '<\\/script');
  function fill(text, map, mode) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in map)) return m;
      const v = map[k];
      if (mode === 'html') return v.html !== undefined ? v.html : esc(v.raw);
      if (mode === 'js') return jsEsc(v.raw);
      return String(v.raw);
    });
  }

  // إصلاح قوالب وصلت بعد ما انحذفت منها علامة $ (يصير لما الكود يمر على أداة تعتبر $ رمز خاص).
  // أشهرها مُحمّل Nerd or Die (NerdLoader): بدونها ما يتعرّف على امتداد الملفات، فما يحمّل GSAP ولا غيره والتنبيه يطلع فاضي.
  function repairCode(code) {
    // نستخدم دوال في replace (مو نص) حتى ما تتفسّر علامة $ في الناتج
    return String(code || '')
      // امتداد الملف:  (?=\?|#|)  →  (?=\?|#|$)
      .split('(?=\\?|#|)/)').join('(?=\\?|#|$)/)')
      // رابط بدون كاش:  `{url}?_nocache=  →  `${url}?_nocache=
      .replace(/`\{url\}\?_nocache=/g, () => '`${url}?_nocache=')
      .replace(/`Cache failed: String\(url\)`/g, () => '`Cache failed: ${String(url)}`');
  }

  // قيم الحقول قد تحتوي متغيرات أخرى، مثل "{alternateFontForAlert}" أو "{name}"
  function resolveNested(tokens, keys) {
    for (let pass = 0; pass < 4; pass++) {
      let changedAny = false;
      for (const k of keys) {
        const t = tokens[k];
        if (typeof t.raw !== 'string' || !/\{\w+\}/.test(t.raw)) continue;
        const next = t.raw.replace(/\{(\w+)\}/g, (m, key) => (key in tokens && key !== k ? String(tokens[key].raw) : m));
        if (next !== t.raw) {
          t.raw = next;
          changedAny = true;
        }
      }
      if (!changedAny) break;
    }
  }

  // innerHTML لا يشغّل وسوم <script>، فنعيد إنشاءها بالترتيب (الخارجية تُنتظر حتى تُحمّل)
  async function runScripts(root) {
    for (const old of [...root.querySelectorAll('script')]) {
      const s = document.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      if (old.src) {
        await new Promise((resolve) => {
          s.onload = s.onerror = resolve;
          old.replaceWith(s);
        });
      } else {
        s.textContent = old.textContent;
        old.replaceWith(s);
      }
    }
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function after(ms, fn) {
    timers.push(setTimeout(fn, Math.max(0, ms)));
  }

  function applyStyle(ev) {
    const s = document.documentElement.style;
    s.setProperty('--ld-font', `"${ev.font}"`);
    s.setProperty('--ld-fs', ev.fontSize + 'px');
    s.setProperty('--ld-fw', ev.fontWeight);
    s.setProperty('--ld-color', ev.textColor);
    s.setProperty('--ld-hl', ev.highlightColor);
    s.setProperty('--ld-img-w', ev.imageSize + 'vw');
    loadFont(ev.font);

    const [v, h] = ev.positionMode === 'custom' ? ev.position.split('-').concat('center').slice(0, 2) : ['center', 'center'];
    const map = { top: 'flex-start', center: 'center', bottom: 'flex-end', left: 'flex-start', right: 'flex-end' };
    stage.style.alignItems = map[v] || 'center';
    stage.style.justifyContent = map[h] || 'center';
    stage.style.direction = 'ltr';
  }

  function show(item) {
    const ev = config && config.events[item.event];
    if (!ev) return next();
    busy = true;
    applyStyle(ev);

    const name = item.user.nickname || item.user.uniqueId || '';
    const custom = !!(ev.custom && ev.custom.enabled);
    const fields = custom ? parseFields(ev) : {};
    // متغيرات الرسالة: الاسم بحركته، وتفاصيل الهدية بلون التمييز
    const extra = { giftName: item.giftName || '', count: item.count || '', amount: item.amount || '' };
    const plainMessage = ev.template.replace(/\{(name|giftName|count|amount)\}/g, (m, k) => (k === 'name' ? name : String(extra[k])));
    const messageHtml = esc(ev.template).replace(/\{(name|giftName|count|amount)\}/g, (m, k) =>
      k === 'name' ? nameHtml(name, ev.textAnim) : `<span class="ld-name">${esc(extra[k])}</span>`);
    // raw: القيمة الخام (CSS/JS)، html: نسخة HTML جاهزة (وإلا تُهرّب raw)
    const tokens = {
      name: { raw: name },
      messageTemplate: { raw: plainMessage, html: messageHtml },
      message: { raw: plainMessage, html: messageHtml },
      userMessage: { raw: item.userMessage || '' },
      amount: { raw: item.amount || '' },
      currency: { raw: item.event === 'gift' ? '💎' : '' },
      giftName: { raw: item.giftName || '' },
      count: { raw: item.count || '' },
      giftImage: { raw: item.giftImage || '' },
      image: { raw: imageFor(ev, item).url },
      media: { raw: imageFor(ev, item).url, html: mediaHtml(ev, item) },
      sound: { raw: ev.sound || '' },
      event: { raw: item.event },
      uniqueId: { raw: item.user.uniqueId || '' },
      avatar: { raw: item.user.avatar || '' },
      duration: { raw: Number(ev.duration) || 8 },
    };
    for (const [k, val] of Object.entries(fields)) if (!(k in tokens)) tokens[k] = { raw: val };
    resolveNested(tokens, Object.keys(fields));

    document.getElementById('ld-custom-css').textContent = custom ? fill(ev.custom.css, tokens, 'css') : '';
    const root = document.createElement('div');
    if (custom) {
      // مثل بيئة Streamlabs: القالب داخل #wrap و #alert-box ويملأ مساحة الويدجت كاملة
      const html = fill(repairCode(ev.custom.html), tokens, 'html');
      if (/id=["']alert-box["']/.test(html)) {
        // قالب يحتوي #alert-box الخاص به (مثل القالب الافتراضي): يحتفظ بتخطيط LiveDeck
        root.className = `ld-alert ld-custom layout-${ev.layout}`;
        root.innerHTML = `<div id="wrap">${html}</div>`;
      } else {
        // قالب Streamlabs: صفحة LTR بدون توسيط، والقالب يحدد مواضعه بنفسه
        root.className = 'ld-alert ld-custom ld-sl';
        root.dir = 'ltr';
        root.innerHTML = `<div id="wrap"><div id="alert-box">${html}</div></div>`;
      }
    } else {
      root.className = `ld-alert layout-${ev.layout}`;
      root.innerHTML = fill(BASE_HTML, tokens, 'html');
      if (ev.positionMode === 'custom') root.style.transform = `translate(${Number(ev.offsetX) || 0}px, ${Number(ev.offsetY) || 0}px)`;
    }
    stage.replaceChildren(root);

    const total = Math.max(2, Number(ev.duration) || 8) * 1000;
    // في الكود المخصص تُطبّق حركة التنبيه على الغلاف الخارجي حتى لا تتعارض مع حركات القالب
    const box = custom ? root : root.firstElementChild || root;
    box.classList.add('ld-in-' + ev.animIn);

    const textWrap = root.querySelector('#alert-text-wrap') || root.querySelector('#alert-message');
    const delay = (Number(ev.textDelay) || 0) * 1000;
    if (textWrap && delay > 0) {
      textWrap.classList.add('ld-hidden');
      after(delay, () => {
        textWrap.classList.remove('ld-hidden');
        if (ev.textIntro !== 'none') textWrap.classList.add('ld-in-' + ev.textIntro);
      });
    } else if (textWrap && ev.textIntro !== 'none') textWrap.classList.add('ld-in-' + ev.textIntro);

    if (textWrap && ev.textOutro !== 'none') {
      after(total - OUT_MS * 2, () => {
        textWrap.classList.remove('ld-in-' + ev.textIntro);
        textWrap.classList.add('ld-out-' + ev.textOutro);
      });
    }

    const vol = Math.max(0, Math.min(100, Number(ev.soundVolume) || 0)) / 100;
    const video = root.querySelector('video');
    if (video) {
      video.volume = vol;
      video.muted = muted;
      video.play().catch(() => {});
    }
    if (ev.sound && !muted) {
      try {
        const a = new Audio(ev.sound);
        a.volume = vol;
        a.play().catch(() => {});
      } catch (_) {}
    }

    if (custom) {
      const shownRoot = root;
      // سكربتات <script> داخل HTML أولاً (بالترتيب)، ثم كود JS
      runScripts(root).then(() => {
        if (stage.firstChild !== shownRoot || !ev.custom.js || !ev.custom.js.trim()) return;
        try {
          new Function('root', 'data', '$', 'jQuery', fill(repairCode(ev.custom.js), tokens, 'js'))(root, { event: item.event, name, message: plainMessage, user: item.user, fields }, window.jQuery, window.jQuery);
        } catch (e) {
          console.error('Custom JS error:', e);
        }
      });
    }

    after(total - OUT_MS, () => {
      box.classList.remove('ld-in-' + ev.animIn);
      box.classList.add('ld-out-' + ev.animOut);
    });
    after(total, () => {
      stage.replaceChildren();
      busy = false;
      next();
    });
  }

  function next() {
    if (busy || !queue.length || !config) return;
    show(queue.shift());
  }

  function push(event, user, extra = {}) {
    if (!config) return;
    const ev = config.events[event];
    if (!ev || !ev.enabled || (config.filter && config.filter[event] === false)) return;
    if (event === 'gift' && Number(extra.amount) < (Number(ev.minAmount) || 0)) return;
    if (queue.length < 50) queue.push({ event, user, ...extra });
    next();
  }

  const giftExtra = (e) => ({ giftName: e.gift.name, count: e.gift.repeatCount, amount: e.gift.total, giftImage: e.gift.image });

  function setConfig(c, f) {
    config = c;
    if (f) fonts = f;
    const ev = config && config.events.follow;
    if (ev) loadFont(ev.font);
  }

  // ---- البث الحي عبر WebSocket ----
  Overlay
    .on('snapshot', (s) => { if (!PREVIEW && s.alertbox) setConfig(s.alertbox, s.alertboxFonts); else if (s.alertboxFonts) fonts = s.alertboxFonts; })
    .on('alertbox-config', (c) => { if (!PREVIEW) setConfig(c); })
    .on('alertbox-test', (t) => { if (!PREVIEW) push(t.event, SAMPLE_USER, SAMPLE_EXTRA[t.event]); })
    .on('follow', (e) => { if (live) push('follow', e.user); })
    .on('gift', (e) => { if (live) push('gift', e.user, giftExtra(e)); })
    .on('share', (e) => { if (live) push('share', e.user); })
    .on('subscribe', (e) => { if (live) push('subscribe', e.user); });

  // ---- أوامر المحرر (المعاينة داخل iframe) ----
  if (PREVIEW) {
    window.addEventListener('message', (m) => {
      const d = m.data || {};
      if (d.cmd === 'config') setConfig(d.config, d.fonts);
      else if (d.cmd === 'test') {
        // المعاينة تقطع التنبيه الحالي لتظهر الإعدادات الجديدة فوراً
        clearTimers();
        queue.length = 0;
        busy = false;
        stage.replaceChildren();
        const ev = config && config.events[d.event];
        if (ev) {
          queue.push({ event: d.event, user: SAMPLE_USER, ...(SAMPLE_EXTRA[d.event] || {}) });
          next();
        }
      } else if (d.cmd === 'bg') document.body.style.background = d.color;
      else if (d.cmd === 'mute') muted = !!d.muted;
      else if (d.cmd === 'live') live = !!d.on;
    });
    parent.postMessage({ cmd: 'ready' }, '*');
  }
})();
