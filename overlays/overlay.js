// عميل WebSocket مشترك لكل صفحات الأوفرلاي مع إعادة اتصال تلقائية (يدعم الفتح من livedeck.live والاتصال بالخادم المحلي)
(function () {
  const handlers = {};
  const params = new URLSearchParams(location.search);
  const localPort = Number(params.get('port')) || 21213;
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost' || location.protocol === 'file:';
  const localOrigin = isLocal ? location.origin : `http://127.0.0.1:${localPort}`;
  const wsHost = isLocal ? location.host : `127.0.0.1:${localPort}`;
  const PRO_OVERLAYS = ['alertbox.html', 'alerts.html', 'goal.html', 'goals.html', 'latest.html', 'music.html', 'ranking.html', 'teams.html', 'top.html', 'valerts.html', 'widget.html'];
  const isProPage = () => {
    if (params.get('preview') === '1' || params.get('demo') === '1') return false;
    const m = /\/overlay\/([a-z0-9-]+\.html)$/i.exec(location.pathname);
    return !!m && PRO_OVERLAYS.includes(m[1].toLowerCase());
  };
  let lockedShown = false;
  function showLocked() {
    if (lockedShown) return;
    lockedShown = true;
    document.body.innerHTML = '<div style="position:fixed;top:12px;right:12px;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(12,10,20,.82);color:#fff;font-size:15px;font-weight:700;font-family:Tajawal,Segoe UI,sans-serif;border:1px solid rgba(255,203,61,.6);direction:rtl"><i style="color:#ffcb3d;font-style:normal">♛</i>هذا الأوفرلاي يحتاج اشتراك LiveDeck PRO</div>';
  }

  const Overlay = {
    isLocal,
    localOrigin,
    mediaUrl(u) {
      if (!u) return '';
      const s = String(u);
      return !isLocal && s.startsWith('/') ? localOrigin + s : s;
    },
    on(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
      return Overlay;
    },
    params,
    el(tag, props, ...children) {
      const e = document.createElement(tag);
      Object.assign(e, props || {});
      for (const c of children) if (c !== null && c !== undefined) e.append(c);
      return e;
    },
    fmt: (n) => Number(n || 0).toLocaleString('en-US'),
  };

  function emit(type, data) {
    (handlers[type] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function connect() {
    const ws = new WebSocket(`ws://${wsHost}/ws`);
    ws.onmessage = (m) => {
      const raw = !isLocal ? String(m.data).replace(/"\/media\//g, `"${localOrigin}/media/`) : m.data;
      const msg = JSON.parse(raw);
      // تغيّر الاشتراك: نعيد التحميل حتى ينقفل/ينفتح الأوفرلاي
      if (msg.type === 'ld-plan') { location.reload(); return; }
      if (msg.type === 'snapshot' && msg.data && msg.data.pro === false && isProPage()) {
        showLocked();
        return;
      }
      if (lockedShown) return;
      if (msg.type === 'event') emit(msg.data.type, msg.data);
      else emit(msg.type, msg.data !== undefined ? msg.data : msg);
    };
    ws.onclose = () => setTimeout(connect, 2000);
  }

  window.Overlay = Overlay;
  window.addEventListener('DOMContentLoaded', connect);
})();
