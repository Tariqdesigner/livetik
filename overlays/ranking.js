// صفحة «التصنيف» (Browser Source): ?type=likes|gifts|shares|live|top20|donations  &k=مفتاح الرابط  ?preview=1 = بيانات تجريبية لو فاضي
(function () {
  const { params } = Overlay;
  const TYPE = params.get('type') || 'likes';
  const PREVIEW = params.get('preview') === '1';
  const KEY = params.get('k') || '';
  const SRC = { likes: 'likes', gifts: 'gifts', shares: 'shares', top20: 'gifts', donations: 'donations' };
  const box = document.getElementById('fit');
  let cfg = null, state = null, frames = [], tabIdx = 0, cycleTimer = 0, loopTimer = 0, testUntil = 0, lastSig = '';

  // البيانات حسب الفترة (اللايف/اليوم/كل الوقت) — يقبل الشكل القديم { likes, gifts… } كمان
  const period = () => (state && state.live ? state[cfg.period] || state.live : state) || {};
  const empty = (d) => !d || !['likes', 'gifts', 'shares', 'donations'].some((k) => (d[k] || []).length);
  // «رابط جديد» يغيّر المفتاح: الروابط القديمة تفضى
  const allowed = () => PREVIEW || !cfg.key || cfg.key === KEY;

  function fit() {
    const w = box.firstElementChild;
    if (!w) return;
    const s = Math.min(1, (innerWidth * 0.95) / Math.max(1, w.offsetWidth), (innerHeight * 0.95) / Math.max(1, w.offsetHeight));
    box.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  function current() {
    const tab = TYPE === 'live' ? cfg.tabs[tabIdx % cfg.tabs.length] : null;
    const d = Date.now() < testUntil || (PREVIEW && empty(period())) ? window.RankRender.sample() : period();
    return { tab, d };
  }
  function render(animate) {
    if (!cfg) return;
    if (!allowed()) { box.replaceChildren(); return; }
    const { tab, d } = current();
    const kind = tab || SRC[TYPE] || 'gifts';
    // حركة عند كل حدث جديد = لما يتغيّر الترتيب (أحد يدخل أو يتقدّم)
    const sig = (d[kind] || []).slice(0, cfg.count).map((x) => x.name).join('|') + '#' + kind;
    if (sig !== lastSig && lastSig && cfg.motion.animate) animate = true;
    lastSig = sig;
    const el = window.RankRender.build(TYPE, cfg, d, { base: '', frames, tab, animate });
    box.replaceChildren(el);
    if (ro) { ro.disconnect(); ro.observe(el); }
    fit();
  }
  // «اللايكات والهدايا والمشاركة»: تتنقل بين التبويبات
  function restartTimers() {
    clearInterval(cycleTimer); clearInterval(loopTimer);
    if (!cfg) return;
    if (TYPE === 'live' && cfg.tabs.length > 1) cycleTimer = setInterval(() => { tabIdx++; render(true); }, cfg.cycle * 1000);
    // يختفي ويرجع كل X ثانية
    if (cfg.motion.loop > 0) loopTimer = setInterval(() => {
      const el = box.firstElementChild;
      if (el) el.classList.add('rk-out');
      setTimeout(() => render(true), 520);
    }, cfg.motion.loop * 1000);
  }
  const take = (all) => { if (all && all[TYPE]) { const prev = cfg && JSON.stringify([cfg.cycle, cfg.tabs, cfg.motion.loop]); cfg = all[TYPE]; if (prev !== JSON.stringify([cfg.cycle, cfg.tabs, cfg.motion.loop])) restartTimers(); } };

  Overlay
    .on('snapshot', (s) => { take(s.rankingConfig); frames = s.latestFrames || frames; state = s.ranking || null; render(true); })
    .on('ranking-config', (all) => { take(all); render(false); })
    .on('ranking', (d) => { state = d; if (Date.now() >= testUntil) render(false); })
    .on('ranking-test', (d) => { if (d.type !== TYPE) return; testUntil = Date.now() + 6000; render(true); setTimeout(() => render(true), 6100); });
})();
