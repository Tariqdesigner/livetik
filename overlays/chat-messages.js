// ============================================================
//  بناء رسائل الشات (مشترك بين الشات الحقيقي ومعاينة الثيمات)
//  كل الثيمات تستخدم نفس الهيكل، والـ CSS هو اللي يغيّر الشكل
// ============================================================

// أيقونات SVG صغيرة (تاخذ لونها من currentColor)
const ICONS = {
  crown:   'M3 7.5l4.6 3.8L12 4l4.4 7.3L21 7.5 19.2 19H4.8z',
  shield:  'M12 2l8 3v6.2c0 5-3.4 9.4-8 10.8-4.6-1.4-8-5.8-8-10.8V5z',
  star:    'M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6-4.8-4.6 6.6-.9z',
  diamond: 'M12 2.5l8.5 9.5-8.5 9.5L3.5 12z',
  heart:   'M12 20.5s-7.6-4.5-9.6-9.1C1.1 8.3 3.2 4.8 6.7 4.8c2 0 3.6 1.1 4.3 2.6h2c.7-1.5 2.3-2.6 4.3-2.6 3.5 0 5.6 3.5 4.3 6.6-2 4.6-9.6 9.1-9.6 9.1z',
  play:    'M8 5.2v13.6L19 12z',
  gift:    'M20 7.5h-2.4a3 3 0 00-5.6-2.2 3 3 0 00-5.6 2.2H4a1 1 0 00-1 1v3h18v-3a1 1 0 00-1-1zm-11 0a1 1 0 110-2c.8 0 1.6.9 2.1 2zm6 0h-2.1c.5-1.1 1.3-2 2.1-2a1 1 0 010 2zM4 13v7a1 1 0 001 1h6v-8zm9 8h6a1 1 0 001-1v-7h-7z',
  share:   'M14 4.5l7 6.8-7 6.9v-4.1c-5 0-8.4 1.5-11 5 1-5 4-9.8 11-10.8z',
  enter:   'M10 17l5-5-5-5v3H3v4h7zM13 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6v-2h6V5h-6z',
};

function svgIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.play);
  svg.appendChild(p);
  return svg;
}

// الأدوار: اللون (تدرج من c1 إلى c2) والأيقونة والاسم
// wm = نص زخرفي قديم (مخفي في كل الثيمات الحالية، باقٍ للتوافق)
const ROLES = {
  host:   { icon: 'crown',   label: 'المذيع', wm: 'ストリーマー', c: ['#ff4d6a', '#ff9f43'] },
  mod:    { icon: 'shield',  label: 'مشرف',   wm: 'モデレーター', c: ['#22e39b', '#3ad7ff'] },
  sub:    { icon: 'star',    label: 'مشترك',  wm: 'サブスク',     c: ['#7c6bff', '#4f8dff'] },
  vip:    { icon: 'diamond', label: 'داعم',   wm: 'サポーター',   c: ['#ff5fd2', '#b45cff'] },
  fan:    { icon: 'heart',   label: 'متابع',  wm: 'ファン',       c: null },
  viewer: { icon: 'play',    label: '',       wm: 'ビューアー',   c: null },
};

// المتابعين والمشاهدين العاديين: لون ثابت لكل شخص من هذي المجموعة (عشان الشات يكون ملوّن)
const PALETTE = [
  ['#4fa8ff', '#7fe0ff'],
  ['#8a6bff', '#5fa2ff'],
  ['#ff6fd8', '#c06bff'],
  ['#2ee6b0', '#45c8ff'],
  ['#ff7a59', '#ffb347'],
  ['#5ee7ff', '#7d9bff'],
];
function hashOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function colorsFor(user) {
  const r = ROLES[user.role] || ROLES.viewer;
  return r.c || PALETTE[hashOf(user.id || user.name || '') % PALETTE.length];
}

// ألوان وأيقونات الأحداث
const EVENTS = {
  follow: { icon: 'heart', c: ['#4db8ff', '#8ad8ff'], text: () => 'تابع البث!' },
  share:  { icon: 'share', c: ['#2fd8e8', '#5ef0c0'], text: () => 'شارك البث!' },
  member: { icon: 'enter', c: ['#8b96a3', '#b6c0cc'], text: () => 'دخل البث' },
  gift:   {
    icon: 'gift',
    c: ['#ff7a45', '#ff4d6a'],
    text: (ev) => `أرسل ${ev.gift || 'هدية'}`,
  },
};

function setColors(el, c) {
  el.style.setProperty('--c1', c[0]);
  el.style.setProperty('--c2', c[1]);
}

// أيقونة الدور + الصورة الشخصية (الـ CSS يقرر أيهم يظهر)
function iconBox(iconName, pic) {
  const ico = document.createElement('span');
  ico.className = 'ico';
  ico.appendChild(svgIcon(iconName));
  if (pic) {
    const img = document.createElement('img');
    img.className = 'av';
    img.src = pic;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    ico.appendChild(img);
  }
  return ico;
}

// النص مع إيموجيات تيك توك في أماكنها
function fillText(el, text, emotes) {
  const list = (emotes || []).slice();
  const inline = list.filter((e) => e.index >= 0).sort((a, b) => a.index - b.index);
  const tail = list.filter((e) => !(e.index >= 0));
  const chars = Array.from(text || '');
  let pos = 0;
  const addImg = (url) => {
    const img = document.createElement('img');
    img.className = 'emote';
    img.src = url;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  };
  for (const e of inline) {
    const at = Math.min(e.index, chars.length);
    if (at > pos) el.appendChild(document.createTextNode(chars.slice(pos, at).join('')));
    addImg(e.url);
    pos = Math.max(pos, at);
  }
  if (pos < chars.length) el.appendChild(document.createTextNode(chars.slice(pos).join('')));
  tail.forEach((e) => addImg(e.url));
  if (!chars.length && list.length) el.classList.add('only-emotes');
}

function formatCompact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// ---------- رسالة تعليق ----------
function buildChat(ev) {
  const user = ev.user;
  const role = ROLES[user.role] ? user.role : 'viewer';
  const el = document.createElement('div');
  el.className = 'msg m-chat';
  el.dataset.role = role;
  el.dataset.uid = user.id;
  setColors(el, colorsFor(user));

  const tag = document.createElement('div');
  tag.className = 'tag';
  const name = document.createElement('span');
  name.className = 'name';
  name.dir = 'auto';
  name.textContent = user.name;
  name.title = '@' + user.id;
  tag.append(iconBox(ROLES[role].icon, user.pic), name);
  if (ROLES[role].label) {
    const r = document.createElement('span');
    r.className = 'role';
    r.textContent = ROLES[role].label;
    tag.appendChild(r);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const text = document.createElement('span');
  text.className = 'text';
  text.dir = 'auto';
  fillText(text, ev.text, ev.emotes);
  const wm = document.createElement('span');
  wm.className = 'wm';
  wm.textContent = ROLES[role].wm;
  bubble.append(text, wm);

  el.append(tag, bubble);
  return el;
}

// ---------- حدث (متابعة / هدية / مشاركة / دخول) ----------
function buildEvent(ev) {
  const info = EVENTS[ev.type];
  const el = document.createElement('div');
  el.className = 'msg m-event ev-' + ev.type;
  el.dataset.uid = ev.user.id;
  setColors(el, info.c);

  const name = document.createElement('b');
  name.className = 'ev-name';
  name.dir = 'auto';
  name.textContent = ev.user.name;
  const txt = document.createElement('span');
  txt.className = 'ev-text';
  txt.textContent = info.text(ev);
  // جملة الحدث عربية، فنثبت اتجاهها يمين→يسار مهما كان اتجاه الشات
  const body = document.createElement('span');
  body.className = 'ev-body';
  body.dir = 'rtl';
  body.append(name, ' ', txt);

  el.append(iconBox(info.icon, ''), body);

  if (ev.type === 'gift') {
    if (ev.icon) {
      const img = document.createElement('img');
      img.className = 'ev-img';
      img.src = ev.icon;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      el.appendChild(img);
    }
    // العدد والقيمة بالألماس (اتجاه ثابت عشان الأرقام ما تتلخبط)
    const parts = [];
    if (ev.count > 1) parts.push('×' + ev.count);
    if (ev.diamonds) parts.push('💎 ' + formatCompact(ev.diamonds));
    if (parts.length) {
      const val = document.createElement('span');
      val.className = 'ev-val';
      val.dir = 'ltr';
      val.textContent = parts.join('  ·  ');
      el.appendChild(val);
    }
  }
  return el;
}

function buildSystem(msg) {
  const el = document.createElement('div');
  el.className = 'msg m-system';
  el.dir = 'rtl';
  el.textContent = msg;
  return el;
}

function buildMessage(ev) {
  return ev.type === 'chat' ? buildChat(ev) : buildEvent(ev);
}

// قائمة الثيمات (الاسم المعروض + بيانات المعاينة)
const THEMES = [
  { id: 'neon',     name: 'لوحة' },
  { id: 'glass',    name: 'ثلجي' },
  { id: 'cyber',    name: 'شريط بث' },
  { id: 'timeline', name: 'مدمج' },
  { id: 'classic',  name: 'كلاسيكي' },
  // الثيمات القديمة بعد تحسينها (معرّفات جديدة حتى لا تتعارض مع الحالية)
  { id: 'glow',     name: 'نيون' },
  { id: 'pane',     name: 'زجاجي' },
  { id: 'tech',     name: 'سايبر' },
  { id: 'line',     name: 'خط زمني' },
];

// رسائل تجريبية للمعاينة
const SAMPLE = [
  { type: 'chat', user: { id: 'mod1', name: 'ModZeraa', role: 'mod' }, text: 'هلا والله نورتوا 👋' },
  { type: 'follow', user: { id: 'nova', name: 'NovaWisp' } },
  { type: 'chat', user: { id: 'kai', name: 'StreamerKai', role: 'host' }, text: 'جولة وحدة ونغير اللعبة' },
];
