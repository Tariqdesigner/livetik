(function () {
  const { el, params, fmt } = Overlay;
  const list = document.getElementById('list');
  const isWindow = params.get('window') === '1';
  let showJoins = params.get('joins') === '1';
  let max = Number(params.get('max')) || 30;
  // لون الأسماء: ?color=ff3366 في الرابط (بدون #)
  if (params.get('color')) document.documentElement.style.setProperty('--c', '#' + params.get('color').replace(/^#/, ''));

  if (isWindow) {
    document.body.classList.add('window');
    document.getElementById('close').onclick = () => window.close();
  }

  function add(user, cls, ...content) {
    const li = el('li', { className: cls || '' }, el('img', { className: 'av', src: user.avatar || '', alt: '' }), el('span', {}, ...content));
    list.append(li);
    while (list.children.length > max) list.firstChild.remove();
  }
  const who = (u) => el('span', { className: 'who', textContent: u.nickname || u.uniqueId });
  const msg = (t) => el('span', { className: 'msg', textContent: t });
  const act = (t) => el('span', { className: 'act', textContent: t });
  const viewers = (n) => (document.getElementById('viewers').textContent = fmt(n) + ' مشاهد');

  Overlay.on('snapshot', (s) => {
    if (s.overlay) {
      showJoins = params.has('joins') ? showJoins : !!s.overlay.showJoins;
      max = Number(params.get('max')) || s.overlay.chatMax || max;
    }
    (s.recent || []).filter((e) => e.type === 'chat').slice(-10).forEach((e) => add(e.user, '', who(e.user), msg(e.comment)));
    if (s.stats) viewers(s.stats.viewers);
  })
    .on('config', (c) => {
      if (c.overlay && !params.has('joins')) showJoins = !!c.overlay.showJoins;
    })
    .on('stats', (s) => viewers(s.viewers))
    .on('chat', (e) => add(e.user, '', who(e.user), msg(e.comment)))
    .on('gift', (e) => add(e.user, 'ev gift', who(e.user), act(`أرسل ${e.gift.name} ×${e.gift.repeatCount}`)))
    .on('follow', (e) => add(e.user, 'ev social', who(e.user), act('تابع البث')))
    .on('share', (e) => add(e.user, 'ev social', who(e.user), act('شارك البث')))
    .on('member', (e) => showJoins && add(e.user, 'ev join', who(e.user), act('دخل البث')));
})();
