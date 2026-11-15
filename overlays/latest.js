// ويدجت «آخر الأحداث»: آخر إعجاب/متابعة/مشاركة/دخول/هدية أو أعلى داعم — يُرسم بـ LatestRender بإعدادات التطبيق
// ?type=like|follow|share|member|gift|top   ?preview=1 (معاينة التطبيق: بيانات تجريبية لو ما فيه حدث للحين)
(function () {
  const { params } = Overlay;
  const KIND = params.get('type') || 'follow';
  const PREVIEW = params.get('preview') === '1';
  const box = document.getElementById('fit');

  const SAMPLE = { name: 'عمر', avatar: '', gift: 'أسد', count: 1, coins: 29999 };
  let cfg = null, frames = [], item = null;
  let testTimer = 0, hideTimer = 0;

  // من بيانات البث لشكل الرسّام
  const toData = (it) => {
    if (!it) return null;
    const u = it.user || {};
    return { name: u.nickname || u.uniqueId || '', avatar: u.avatar || '', gift: (it.gift && it.gift.name) || '', count: (it.gift && it.gift.repeatCount) || it.count || 0, coins: it.diamonds || 0 };
  };

  // يكبّر/يصغّر الويدجت حتى يتسع في مقاس المصدر (بدون تكبير فوق 100%)
  function fit() {
    const w = box.firstElementChild;
    if (!w) return;
    // المقاس الحقيقي بدون تحويل (offset ما يتأثر بالـ transform)
    const s = Math.min(1, (innerWidth * 0.94) / Math.max(1, w.offsetWidth), (innerHeight * 0.94) / Math.max(1, w.offsetHeight));
    box.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);
  // الخط أو صورة المشاهد يكبّرون الويدجت بعد ما يتحمّلون — نعيد الحساب
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  function show(data, animate) {
    clearTimeout(hideTimer);
    if (!cfg) return;
    if (!data) {
      box.replaceChildren(PREVIEW ? Object.assign(document.createElement('div'), { className: 'wait', textContent: '…' }) : '');
      return;
    }
    const el = window.LatestRender.build(cfg, data, { kind: KIND, base: '', frames, animate });
    box.replaceChildren(el);
    if (ro) { ro.disconnect(); ro.observe(el); }
    fit();
    // مدة الظهور: بعدها يختفي لين يجي حدث جديد
    if (!cfg.motion.stay && !PREVIEW) hideTimer = setTimeout(() => el.classList.add('lt-out'), cfg.motion.duration * 1000);
  }
  const current = () => toData(item) || (PREVIEW ? SAMPLE : null);

  const setCfg = (all) => { if (all && all[KIND]) cfg = all[KIND]; };

  Overlay
    .on('snapshot', (s) => {
      setCfg(s.latestWidgets);
      frames = s.latestFrames || frames;
      item = (s.latest || {})[KIND] || null;
      show(current(), false);
    })
    .on('latest-config', (all) => {
      setCfg(all);
      if (!testTimer) show(current(), false);
    })
    .on('latest', (d) => {
      if (d.kind !== KIND) return;
      item = d.item;
      if (!testTimer) show(current(), true);
    })
    // زر «تجربة» في التطبيق: عرض تجريبي مؤقت ثم الرجوع للقيمة الحقيقية
    .on('latest-test', (d) => {
      if (d.kind !== KIND) return;
      clearTimeout(testTimer);
      show(SAMPLE, true);
      testTimer = setTimeout(() => { testTimer = 0; show(current(), true); }, 5000);
    });
})();
