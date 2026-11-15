// نافذة الشات العائمة — نفس مميزات مشروع chat tiktok
// (الثيمات، التثبيت، تغيير الحجم من كل الحواف، الشفافية، الاختفاء، الكلمات المحظورة، الكتم، الاختصارات)
// الأحداث تصل من اتصال LiveDeck عبر WebSocket (overlay.js) وتتحول لنفس شكل رسائل المشروع.
const api = window.livedeckChat;
const $ = (id) => document.getElementById(id);
const MAX_MESSAGES = 250;

let settings;
let connected = false;
let stickToBottom = true;
let channel = ''; // حساب البث الحالي (لتمييز المذيع)

const feed = $('feed');

// ---------- تهيئة ----------
(async function init() {
  settings = await api.getSettings();

  $('fontSize').value = settings.fontSize;
  $('opacity').value = settings.opacity;
  $('blockedWords').value = (settings.blockedWords || []).join(', ');
  document.querySelectorAll('[data-show]').forEach((cb) => {
    cb.checked = settings.show[cb.dataset.show] !== false;
  });
  $('fadeAfter').value = settings.fadeAfter ?? 30;
  $('showAvatars').checked = !!settings.showAvatars;
  applyAvatars();
  applySide(settings.side || 'right');
  applyTheme(settings.theme);
  applyFont();
  applyOpacity();
  applyFade();
  renderMuted();
  sendPinRect();
  startEvents();
})();

function save(patch) {
  Object.assign(settings, patch);
  api.saveSettings(patch);
}

// ---------- أزرار الشريط ----------
$('btnClose').onclick = () => api.close();
$('btnMin').onclick = () => api.minimize();
$('btnSettings').onclick = () => {
  // من وضع التثبيت: نفك التثبيت أول عشان تقدر تتعامل مع الإعدادات
  if (locked) {
    api.setLocked(false);
    $('settings').classList.remove('hidden');
    return;
  }
  $('settings').classList.toggle('hidden');
};
// نعرف متى الإعدادات مفتوحة (عشان الشريط العلوي والأدوات تصير بخلفية ثابتة)
new MutationObserver(() => {
  document.body.classList.toggle('settings-open', !$('settings').classList.contains('hidden'));
}).observe($('settings'), { attributes: true, attributeFilter: ['class'] });

// رابط الحقوق: يشتغل بس والإعدادات مفتوحة
$('creditLink').onclick = (e) => {
  e.preventDefault();
  if (document.body.classList.contains('settings-open')) api.openCredit();
};

// ---------- التثبيت ----------
let locked = false;
const lockBtn = $('btnLock');
lockBtn.onclick = () => api.setLocked(!locked);

// نرسل أماكن زر 📌 و ⚙ للبرنامج، وهو يراقب الماوس:
// فوق أحدهم = يقبل النقر، غير كذا = النقرات تعدّي للي تحت
function sendPinRect() {
  const rects = [lockBtn, $('btnSettings')]
    .map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 0)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  api.pinRect(rects);
}
window.addEventListener('resize', sendPinRect);

// ---------- تغيير الحجم ----------
document.querySelectorAll('.rz').forEach((h) => {
  h.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || locked) return;
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing');
    api.resizeStart(h.dataset.dir);
  });
  const end = () => {
    document.body.classList.remove('resizing');
    api.resizeEnd();
  };
  h.addEventListener('pointerup', end);
  h.addEventListener('lostpointercapture', end);
});
window.addEventListener('blur', () => api.resizeEnd());

api.on('locked', (on) => {
  locked = on;
  document.body.classList.toggle('locked', on);
  lockBtn.classList.toggle('active', on);
  lockBtn.title = on ? 'فك التثبيت' : 'تثبيت الشات';
  if (on) $('settings').classList.add('hidden');
  // مكان الزر يتغير لما تختفي الأزرار الثانية، فنرسله بعد ما تتحدث الواجهة
  requestAnimationFrame(sendPinRect);
});

// ---------- الاختصارات ----------
function showShortcuts(s) {
  const fmt = (a) => (a ? a.replace('CommandOrControl', 'Ctrl') : 'غير متاح');
  $('shortcutsHint').textContent = `تثبيت/فك: ${fmt(s.lock)}  ·  إخفاء/إظهار: ${fmt(s.hide)}`;
  lockBtn.title = (locked ? 'فك التثبيت' : 'تثبيت الشات') + (s.lock ? ` (${fmt(s.lock)})` : '');
}
api.on('shortcuts', showShortcuts);
api.getShortcuts().then(showShortcuts);

// ---------- الاتصال (نفس اتصال LiveDeck) ----------
$('btnConnect').onclick = toggleConnect;
$('username').addEventListener('keydown', (e) => e.key === 'Enter' && toggleConnect());

async function toggleConnect() {
  if (connected) {
    await api.disconnect();
    return;
  }
  const res = await api.connect($('username').value.trim().replace(/^@/, ''));
  if (res && res.ok) $('settings').classList.add('hidden');
  else if (res && res.error) addSystem('فشل الاتصال: ' + res.error);
}

// حالات LiveDeck → حالات النافذة
const STATE = { connected: 'on', connecting: 'connecting', ended: 'ended', disconnected: 'off', error: 'off' };
let lastState = '';
function onStatus(st, silent) {
  const state = STATE[st.state] || 'off';
  channel = String(st.uniqueId || channel || '').toLowerCase();
  connected = state === 'on';
  if (st.uniqueId && !$('username').value) $('username').value = st.uniqueId;
  const msg = {
    on: `متصل بـ @${st.uniqueId}`,
    connecting: `جاري الاتصال بـ @${st.uniqueId}...`,
    ended: 'انتهى البث',
    off: st.error ? 'فشل الاتصال: ' + st.error : 'غير متصل',
  }[state];
  $('statusDot').className = 'status-dot ' + state;
  $('statusDot').title = msg;
  const btn = $('btnConnect');
  btn.textContent = connected ? 'قطع' : state === 'connecting' ? '...' : 'اتصال';
  btn.classList.toggle('danger', connected);
  if (silent || state === lastState) { lastState = state; return; }
  if (state === 'on') clearFeed();
  lastState = state;
  addSystem(msg);
}

// ---------- الحجم والشفافية ----------
$('fontSize').oninput = () => {
  save({ fontSize: +$('fontSize').value });
  applyFont();
};
function applyFont() {
  document.documentElement.style.setProperty('--font', settings.fontSize + 'px');
  $('fontSizeVal').textContent = settings.fontSize;
}

$('opacity').oninput = () => {
  save({ opacity: +$('opacity').value });
  applyOpacity();
};
function applyOpacity() {
  document.documentElement.style.setProperty('--bg-alpha', settings.opacity);
  // عند 0: شفاف كامل (بدون خلفية ولا حدود ولا خطوط فاصلة)
  const clear = settings.opacity <= 0.001;
  document.body.classList.toggle('fully-clear', clear);
  $('opacityVal').textContent = clear ? 'شفاف كامل' : Math.round(settings.opacity * 100) + '%';
}

// ---------- الثيمات ----------
// كل زر ثيم فيه معاينة حية: رسائل تجريبية مرسومة بنفس شكل الثيم
function renderThemes() {
  const box = $('themes');
  box.innerHTML = '';
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.className = 'theme-btn';
    b.dataset.theme = t.id;
    const pv = document.createElement('div');
    pv.className = 'preview';
    pv.dataset.theme = t.id;
    pv.dataset.side = settings.side || 'right';
    SAMPLE.forEach((ev) => pv.appendChild(buildMessage(ev)));
    const label = document.createElement('span');
    label.textContent = t.name;
    b.append(pv, label);
    b.onclick = () => {
      save({ theme: t.id });
      applyTheme(t.id);
    };
    box.appendChild(b);
  }
}

function applyTheme(id) {
  if (!THEMES.some((t) => t.id === id)) id = 'neon';
  feed.dataset.theme = id;
  document.body.dataset.ui = id;
  document.querySelectorAll('.theme-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === id);
  });
}

// ---------- الاتجاه (يمين / يسار) ----------
document.querySelectorAll('#sidePicker button').forEach((b) => {
  b.onclick = () => {
    save({ side: b.dataset.side });
    applySide(b.dataset.side);
  };
});
function applySide(side) {
  if (side !== 'left') side = 'right';
  feed.dataset.side = side;
  document.querySelectorAll('#sidePicker button').forEach((b) => {
    b.classList.toggle('active', b.dataset.side === side);
  });
  // نعيد رسم المعاينات بالاتجاه الجديد
  renderThemes();
  applyTheme(settings.theme);
}

// ---------- الصورة الشخصية ----------
$('showAvatars').onchange = () => {
  save({ showAvatars: $('showAvatars').checked });
  applyAvatars();
};
function applyAvatars() {
  document.body.classList.toggle('show-avatars', !!settings.showAvatars);
}

// ---------- اختفاء الرسائل القديمة ----------
$('fadeAfter').oninput = () => {
  save({ fadeAfter: +$('fadeAfter').value });
  applyFade();
};
function applyFade() {
  const s = settings.fadeAfter ?? 30;
  $('fadeVal').textContent = s ? `${s} ثانية` : 'ما تختفي';
}
// كل رسالة لها مؤقت: بعد المدة تتلاشى وتنحذف
function scheduleFade(el) {
  const s = settings.fadeAfter ?? 30;
  if (!s) return;
  el._fadeTimer = setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => el.remove(), 700);
  }, s * 1000);
}

// ---------- الفلاتر ----------
document.querySelectorAll('[data-show]').forEach((cb) => {
  cb.onchange = () => save({ show: { ...settings.show, [cb.dataset.show]: cb.checked } });
});

$('blockedWords').onchange = () => {
  const words = $('blockedWords').value.split(/[,،]/).map((w) => w.trim()).filter(Boolean);
  save({ blockedWords: words });
};

// ---------- الكتم ----------
// الكتم هنا دائم (محفوظ)، وكمان يُبلغ LiveDeck حتى ما تُنفّذ أوامر المكتوم في البوت والإجراءات
function muteUser(user) {
  if (!user.id || settings.mutedUsers.some((m) => m.id === user.id)) return;
  save({ mutedUsers: [...settings.mutedUsers, { id: user.id, name: user.name }] });
  api.mute({ uniqueId: user.id, nickname: user.name }, 0);
  // نحذف رسائله الموجودة
  feed.querySelectorAll(`.msg[data-uid="${CSS.escape(user.id)}"]`).forEach((el) => el.remove());
  renderMuted();
}
function unmuteUser(id) {
  save({ mutedUsers: settings.mutedUsers.filter((m) => m.id !== id) });
  api.unmute(id);
  renderMuted();
}
function renderMuted() {
  const box = $('mutedList');
  box.innerHTML = '';
  if (!settings.mutedUsers.length) {
    box.innerHTML = '<em class="muted-empty">لا يوجد</em>';
    return;
  }
  settings.mutedUsers.forEach((m) => {
    const c = document.createElement('span');
    c.className = 'chip';
    c.title = 'إلغاء الكتم';
    c.textContent = m.name;
    c.onclick = () => unmuteUser(m.id);
    box.appendChild(c);
  });
}

function isFiltered(ev) {
  if (ev.type !== 'chat' && settings.show[ev.type] === false) return true;
  if (ev.user && settings.mutedUsers.some((m) => m.id === ev.user.id)) return true;
  if (ev.type === 'chat' && settings.blockedWords.length) {
    const t = ev.text.toLowerCase();
    if (settings.blockedWords.some((w) => t.includes(w.toLowerCase()))) return true;
  }
  return false;
}

// ---------- تحويل أحداث LiveDeck لشكل رسائل المشروع ----------
function roleOf(u) {
  if (u.isHost || (channel && String(u.uniqueId || '').toLowerCase() === channel)) return 'host';
  if (u.isModerator) return 'mod';
  if (u.isSubscriber) return 'sub';
  if (u.isGiftGiver) return 'vip';
  if (u.isFollower) return 'fan';
  return 'viewer';
}
function userOf(u) {
  return { id: String(u.uniqueId || u.id || ''), name: u.nickname || u.uniqueId || 'مستخدم', pic: u.avatar || '', role: roleOf(u) };
}
function convert(e) {
  const user = userOf(e.user || {});
  switch (e.type) {
    case 'chat': return { type: 'chat', user, text: e.comment || '', emotes: e.emotes || [] };
    case 'gift': return { type: 'gift', user, gift: e.gift.name, count: e.gift.repeatCount, diamonds: e.gift.total, icon: e.gift.image };
    case 'follow':
    case 'share':
    case 'member': return { type: e.type, user };
    default: return null;
  }
}

// ---------- عرض التعليقات ----------
function onEvent(e) {
  const ev = convert(e);
  if (!ev || isFiltered(ev)) return;
  addMessage(ev);
}

function startEvents() {
  Overlay
    .on('snapshot', (s) => {
      if (s.status) onStatus(s.status, true);
      if (s.stats) $('viewers').textContent = formatNum(s.stats.viewers || 0);
      (s.recent || []).filter((e) => e.type === 'chat').slice(-20).forEach(onEvent);
    })
    .on('status', (st) => onStatus(st))
    .on('stats', (s) => ($('viewers').textContent = formatNum(s.viewers || 0)))
    .on('chat', onEvent)
    .on('gift', onEvent)
    .on('follow', onEvent)
    .on('share', onEvent)
    .on('member', onEvent)
    // كتم من لوحة LiveDeck: نحذف رسائل المكتوم من النافذة
    .on('mutes', (list) => (list || []).forEach((m) => feed.querySelectorAll(`.msg[data-uid="${CSS.escape(m.uniqueId)}"]`).forEach((el) => el.remove())));
}

function addMessage(ev) {
  if (!EVENTS[ev.type] && ev.type !== 'chat') return;
  $('placeholder')?.remove();

  const el = buildMessage(ev);

  const mute = document.createElement('button');
  mute.className = 'mute-btn';
  mute.textContent = 'كتم';
  mute.title = 'كتم هذا المستخدم';
  mute.onclick = () => muteUser(ev.user);
  el.appendChild(mute);

  pushEl(el);
}

function addSystem(msg) {
  pushEl(buildSystem(msg));
}

function pushEl(el) {
  // الجديد ينضاف تحت، والقديم فوق
  feed.appendChild(el);
  scheduleFade(el);
  while (feed.children.length > MAX_MESSAGES) feed.firstElementChild.remove();
  if (stickToBottom) feed.scrollTop = feed.scrollHeight;
  else $('jumpDown').classList.remove('hidden');
}

function clearFeed() {
  feed.innerHTML = '';
  $('viewers').textContent = '0';
}

// إذا المستخدم طلع لفوق نوقف النزول التلقائي
feed.addEventListener('scroll', () => {
  stickToBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  if (stickToBottom) $('jumpDown').classList.add('hidden');
});
$('jumpDown').onclick = () => {
  feed.scrollTop = feed.scrollHeight;
};

const formatNum = formatCompact;
