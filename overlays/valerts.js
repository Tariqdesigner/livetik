// مشغّل الأليرتات: يستقبل {type:'valert'} من الخادم ويعرضها بالدور (فيديو/صورة أو حركة مدمجة شفافة).
// وضع المعاينة: ?demo=1&fx=..&text=..&c=..&c2=..&sub=..&d=..&loop=1  (still=1 = إطار ثابت للصورة المصغّرة)
(function () {
  const P = new URLSearchParams(location.search);
  const DEMO = P.get('demo') === '1';
  const stage = document.getElementById('stage');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- محرك الجسيمات ----------
  function makeCanvas() {
    const cv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { cv, ctx, W: innerWidth, H: innerHeight };
  }

  function heart(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.45, -s * 1.05, s, -s * 0.35, 0, s * 0.3);
    ctx.fill();
  }
  function star4(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.22 : s;
      const a = (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // كل fx: spawn(t) يضيف جسيمات، draw(p) يرسم جسيماً، bg(ctx,t) خلفية اختيارية
  const FX = {
    hearts: {
      rate: 14,
      spawn: (o) => ({ x: rnd(0, o.W), y: o.H + 30, vx: rnd(-20, 20), vy: rnd(-260, -140), s: rnd(10, 30), ph: rnd(0, 6), col: pick([o.c, o.c2, o.c]), life: 6 }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 2 + p.ph) * 40) * dt; p.y += p.vy * dt; },
      draw: (ctx, p) => { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 14; heart(ctx, p.s); },
      burst: (o) => Array.from({ length: 40 }, () => { const a = rnd(0, Math.PI * 2), v = rnd(150, 520); return { x: o.W / 2, y: o.H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(8, 22), ph: 0, col: pick([o.c, o.c2]), life: 2.2, drag: 1.8 }; }),
    },
    stars: {
      rate: 26,
      spawn: (o) => ({ x: rnd(0, o.W), y: rnd(0, o.H), vx: 0, vy: rnd(-15, 15), s: rnd(4, 16), col: pick([o.c, o.c2, '#fff']), life: rnd(0.8, 1.8), tw: true }),
      draw: (ctx, p) => { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 18; star4(ctx, p.s * Math.sin(Math.PI * Math.min(1, p.age / p.life))); },
      burst: (o) => Array.from({ length: 60 }, () => { const a = rnd(0, Math.PI * 2), v = rnd(200, 700); return { x: o.W / 2, y: o.H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(5, 14), col: pick([o.c, o.c2, '#fff']), life: 1.6, drag: 2.2 }; }),
    },
    confetti: {
      rate: 60,
      spawn: (o) => ({ x: rnd(0, o.W), y: -20, vx: rnd(-60, 60), vy: rnd(120, 260), s: rnd(6, 12), r: rnd(0, 6), vr: rnd(-8, 8), col: pick([o.c, o.c2, '#ffd23f', '#ffffff', '#ff4d8d']), life: 7 }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 3 + p.r) * 30) * dt; p.y += p.vy * dt; p.r += p.vr * dt; },
      draw: (ctx, p) => { ctx.rotate(p.r); ctx.scale(1, Math.cos(p.r * 1.7)); ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); },
      burst: (o) => Array.from({ length: 120 }, () => { const a = rnd(-Math.PI, 0), v = rnd(300, 900); return { x: o.W / 2, y: o.H * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(6, 12), r: rnd(0, 6), vr: rnd(-10, 10), col: pick([o.c, o.c2, '#ffd23f', '#fff']), life: 3, drag: 1.4, g: 500 }; }),
    },
    embers: {
      rate: 70,
      spawn: (o) => ({ x: rnd(0, o.W), y: o.H + 10, vx: rnd(-30, 30), vy: rnd(-320, -120), s: rnd(1.5, 4.5), col: pick([o.c, o.c2, '#ffb000']), life: rnd(1.5, 3.5), ph: rnd(0, 6) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 5 + p.ph) * 50) * dt; p.y += p.vy * dt; },
      draw: (ctx, p) => { ctx.globalAlpha *= 1 - p.age / p.life; ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); },
      bg: (ctx, o, t) => { const g = ctx.createLinearGradient(0, o.H, 0, o.H * 0.55); g.addColorStop(0, hexA(o.c, 0.55 + Math.sin(t * 9) * 0.06)); g.addColorStop(1, hexA(o.c, 0)); ctx.fillStyle = g; ctx.fillRect(0, o.H * 0.55, o.W, o.H * 0.45); },
    },
    petals: {
      rate: 22,
      spawn: (o) => ({ x: rnd(-50, o.W), y: -30, vx: rnd(20, 80), vy: rnd(80, 170), s: rnd(8, 16), r: rnd(0, 6), vr: rnd(-3, 3), col: pick([o.c, o.c, o.c2]), life: 9, ph: rnd(0, 6) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t * 1.5 + p.ph) * 60) * dt; p.y += p.vy * dt; p.r += p.vr * dt; },
      draw: (ctx, p) => { ctx.rotate(p.r); ctx.scale(1, 0.55 + 0.45 * Math.cos(p.r * 2)); ctx.fillStyle = p.col; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, 7); ctx.fill(); },
      burst: (o) => Array.from({ length: 50 }, () => { const a = rnd(0, Math.PI * 2), v = rnd(200, 600); return { x: o.W / 2, y: o.H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(8, 15), r: rnd(0, 6), vr: rnd(-6, 6), col: pick([o.c, o.c2]), life: 2.5, drag: 1.6, g: 120 }; }),
    },
    snow: {
      rate: 40,
      spawn: (o) => ({ x: rnd(0, o.W), y: -10, vx: rnd(-20, 20), vy: rnd(50, 140), s: rnd(1.5, 4), col: pick(['#fff', o.c2, o.c]), life: 12, ph: rnd(0, 6) }),
      step: (p, dt, t) => { p.x += (p.vx + Math.sin(t + p.ph) * 25) * dt; p.y += p.vy * dt; },
      draw: (ctx, p) => { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); },
      burst: (o) => Array.from({ length: 70 }, () => { const a = rnd(0, Math.PI * 2), v = rnd(250, 750); return { x: o.W / 2, y: o.H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(2, 5), col: pick(['#fff', o.c]), life: 1.6, drag: 2.4 }; }),
    },
    coins: {
      rate: 18,
      spawn: (o) => ({ x: rnd(0, o.W), y: -30, vx: rnd(-15, 15), vy: rnd(220, 380), s: rnd(10, 20), r: rnd(0, 6), vr: rnd(4, 9), life: 6 }),
      step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; },
      draw: (ctx, p, o) => {
        const sx = Math.max(0.12, Math.abs(Math.cos(p.r)));
        ctx.scale(sx, 1);
        ctx.fillStyle = o.c; ctx.shadowColor = o.c; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = o.c2; ctx.lineWidth = p.s * 0.15; ctx.beginPath(); ctx.arc(0, 0, p.s * 0.68, 0, 7); ctx.stroke();
      },
      burst: (o) => Array.from({ length: 30 }, () => { const a = rnd(-Math.PI, 0), v = rnd(300, 800); return { x: o.W / 2, y: o.H * 0.55, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(10, 18), r: rnd(0, 6), vr: rnd(4, 10), life: 2.6, drag: 0.8, g: 900 }; }),
    },
    warp: {
      rate: 90,
      spawn: (o) => { const a = rnd(0, Math.PI * 2); return { x: o.W / 2, y: o.H / 2, a, v: rnd(80, 200), s: rnd(1, 2.5), col: pick(['#fff', o.c, o.c2]), life: 2.2 }; },
      step: (p, dt) => { p.v *= 1 + 3.2 * dt; p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt; },
      draw: (ctx, p) => { const l = p.v * 0.06; ctx.strokeStyle = p.col; ctx.lineWidth = p.s; ctx.shadowColor = p.col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(p.a) * l, -Math.sin(p.a) * l); ctx.stroke(); },
    },
    ring: {
      rate: 30,
      spawn: (o) => { const a = rnd(0, Math.PI * 2); return { x: o.W / 2, y: o.H / 2, orbit: a, R: rnd(o.M * 0.22, o.M * 0.42), w: rnd(0.8, 2) * pick([1, -1]), s: rnd(1.5, 3.5), col: pick([o.c, o.c2, '#fff']), life: rnd(1, 2.4) }; },
      step: (p, dt, t, o) => { p.orbit += p.w * dt; p.x = o.W / 2 + Math.cos(p.orbit) * p.R; p.y = o.H / 2 + Math.sin(p.orbit) * p.R * 0.42; },
      draw: (ctx, p) => { ctx.globalAlpha *= Math.sin(Math.PI * Math.min(1, p.age / p.life)); ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); },
      bg: (ctx, o, t) => {
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.55 + i / 3) % 1);
          ctx.strokeStyle = hexA(i % 2 ? o.c2 : o.c, (1 - k) * 0.85); ctx.lineWidth = 3 + (1 - k) * 4; ctx.shadowColor = o.c; ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.ellipse(o.W / 2, o.H / 2, o.M * (0.12 + k * 0.42), o.M * (0.05 + k * 0.18), 0, 0, 7); ctx.stroke();
        }
        ctx.shadowBlur = 0;
      },
    },
    hazard: {
      rate: 0,
      bg: (ctx, o, t) => {
        const band = Math.max(18, o.H * 0.06), off = (t * 120) % (band * 2);
        for (const y of [0, o.H - band]) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, y, o.W, band); ctx.clip();
          ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, y, o.W, band);
          ctx.fillStyle = o.c;
          for (let x = -band * 2 - off; x < o.W + band * 2; x += band * 2) { ctx.beginPath(); ctx.moveTo(x, y + band); ctx.lineTo(x + band, y); ctx.lineTo(x + band * 2, y); ctx.lineTo(x + band, y + band); ctx.fill(); }
          ctx.restore();
        }
        const pulse = (Math.sin(t * 8) + 1) / 2;
        const g = ctx.createRadialGradient(o.W / 2, o.H / 2, o.M * 0.3, o.W / 2, o.H / 2, o.M * 0.9);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, hexA(o.c, 0.15 + pulse * 0.35));
        ctx.fillStyle = g; ctx.fillRect(0, band, o.W, o.H - band * 2);
      },
    },
    lightning: {
      rate: 20,
      spawn: (o) => ({ x: rnd(0, o.W), y: rnd(0, o.H), vx: 0, vy: rnd(-40, 40), s: rnd(1, 3), col: pick([o.c, '#fff']), life: rnd(0.4, 1) }),
      draw: (ctx, p) => { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); },
      bg: (ctx, o, t, st) => {
        st.next = st.next || 0;
        if (t >= st.next) { st.bolt = makeBolt(o); st.at = t; st.next = t + rnd(0.35, 0.9); }
        const k = st.bolt ? 1 - (t - st.at) / 0.3 : 0;
        if (k > 0) {
          ctx.fillStyle = hexA(o.c2, k * 0.1); ctx.fillRect(0, 0, o.W, o.H);
          ctx.strokeStyle = hexA(o.c2, k); ctx.shadowColor = o.c; ctx.shadowBlur = 30; ctx.lineWidth = 4;
          for (const path of st.bolt) { ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.lineWidth = 2; }
          ctx.shadowBlur = 0;
        }
      },
    },
    glitch: {
      rate: 0,
      bg: (ctx, o, t) => {
        ctx.fillStyle = 'rgba(255,255,255,.035)';
        for (let y = 0; y < o.H; y += 4) ctx.fillRect(0, y, o.W, 1);
        if (Math.random() < 0.35) for (let i = 0; i < 4; i++) { ctx.fillStyle = hexA(pick([o.c, o.c2]), 0.35); ctx.fillRect(rnd(0, o.W), rnd(0, o.H), rnd(30, o.W * 0.3), rnd(3, 14)); }
      },
    },
  };

  function makeBolt(o) {
    const paths = [];
    let x = rnd(o.W * 0.1, o.W * 0.9), y = 0;
    const main = [[x, y]];
    while (y < o.H) { x += rnd(-60, 60); y += rnd(30, 70); main.push([x, y]); if (Math.random() < 0.2) { const br = [[x, y]]; let bx = x, by = y; for (let i = 0; i < 4; i++) { bx += rnd(-70, 70); by += rnd(20, 50); br.push([bx, by]); } paths.push(br); } }
    paths.unshift(main);
    return paths;
  }

  function hexA(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  // ---------- تشغيل أليرت مدمج ----------
  function playBuiltin(item, text, { still = false, loop = false } = {}) {
    return new Promise((resolve) => {
      const { cv, ctx, W, H } = makeCanvas();
      stage.append(cv);
      const o = { W, H, M: Math.min(W, H), c: item.color || '#7c5cff', c2: item.color2 || '#ffffff' };
      const fx = FX[item.fx] || FX.stars;
      const sub = item.sub ? FX[item.sub] : null;
      const dur = Math.max(2, Number(item.duration) || 6);

      const title = document.createElement('div');
      title.className = 'title';
      title.style.setProperty('--c', o.c);
      title.style.setProperty('--c2', o.c2);
      const isCounter = item.fx === 'counter';
      const target = isCounter ? Math.max(1, parseInt(String(text).replace(/[^\d]/g, ''), 10) || 1) : 0;
      if (isCounter) title.classList.add('counter');
      const label = String(text || '');
      const len = [...label].length;
      if (!isCounter && len > 9) title.style.setProperty('--fs', Math.max(6, 13 - (len - 9) * 0.5) + 'vmin');
      if (item.fx === 'glitch') { title.classList.add('glitch'); title.dataset.text = label; }
      title.textContent = isCounter ? (still ? String(target) : '0') : label;
      stage.append(title);
      if (still) title.classList.add('static');
      else if (item.fx !== 'glitch') title.classList.add('in');

      let parts = [];
      const st = {};
      const add = (f, list) => { for (const p of list) { p.age = 0; p.f = f; parts.push(p); } };
      const spawners = [fx, sub].filter(Boolean);
      if (isCounter && !sub) spawners.push(FX.stars);
      for (const f of spawners) if (f.burst) add(f, f.burst(o));
      const acc = new Map();
      let t = 0, last = performance.now(), shown = 0, done = false;

      function update(dt) {
        t += dt;
        for (const f of spawners) {
          if (!f.rate || t > dur - 1) continue;
          const a = (acc.get(f) || 0) + f.rate * dt;
          const n = Math.floor(a);
          acc.set(f, a - n);
          for (let i = 0; i < n; i++) add(f, [f.spawn(o)]);
        }
        parts = parts.filter((p) => {
          p.age += dt;
          if (p.f.step) p.f.step(p, dt, t, o);
          else { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; }
          if (p.drag) { p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt); }
          if (p.g) p.vy += p.g * dt;
          return p.age < p.life && p.y < H + 60 && p.y > -80 && p.x > -80 && p.x < W + 80;
        });
        if (isCounter && !still) {
          const k = Math.min(1, t / (dur * 0.55));
          const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
          if (v !== shown) { shown = v; title.textContent = String(v); title.classList.remove('bump'); void title.offsetWidth; title.classList.add('bump'); }
        }
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        const fade = still ? 1 : Math.min(1, Math.max(0, (dur - t) / 0.6));
        ctx.globalAlpha = fade;
        for (const f of spawners) if (f.bg) { ctx.save(); f.bg(ctx, o, t, st); ctx.restore(); }
        for (const p of parts) {
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          p.f.draw(ctx, p, o);
          ctx.restore();
        }
      }

      if (still) {
        for (let i = 0; i < 90; i++) update(1 / 60);
        draw();
        return resolve();
      }

      function frame(now) {
        if (done) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt);
        draw();
        if (t >= dur - 0.55 && !title.classList.contains('out')) { title.classList.remove('in', 'bump'); title.classList.add('out'); }
        if (t >= dur) {
          done = true;
          cv.remove();
          title.remove();
          if (loop) setTimeout(() => playBuiltin(item, text, { loop }).then(resolve), 300);
          else resolve();
          return;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  // ---------- تشغيل فيديو/صورة ----------
  function playMedia(item, text, volume) {
    return new Promise((resolve) => {
      let node;
      let finished = false;
      const end = () => { if (finished) return; finished = true; node.remove(); if (cap) cap.remove(); if (snd) snd.pause(); resolve(); };
      if (item.kind === 'video') {
        node = document.createElement('video');
        node.src = item.src;
        node.autoplay = true;
        node.playsInline = true;
        node.volume = volume;
        node.onended = end;
        node.onerror = end;
        node.play().catch(() => { node.muted = true; node.play().catch(end); });
      } else {
        node = document.createElement('img');
        node.className = 'vimg';
        node.src = item.src;
      }
      stage.append(node);
      let cap = null;
      if (text) { cap = document.createElement('div'); cap.className = 'caption'; cap.textContent = text; stage.append(cap); }
      let snd = null;
      if (item.sound) { snd = new Audio(item.sound); snd.volume = volume; snd.play().catch(() => {}); }
      const maxMs = (Number(item.duration) || (item.kind === 'video' ? 60 : 5)) * 1000 + (item.kind === 'video' ? 1500 : 0);
      setTimeout(end, maxMs);
    });
  }

  // ---------- إجراء مرئي: فيديو/حركة + بطاقة الداعم + صوت لمدة محددة ----------
  let fonts = null;
  function playAction(job, signal) {
    return new Promise((resolve) => {
      const vol = (x) => Math.max(0, Math.min(1, (x === undefined ? 80 : Number(x)) / 100));
      const durS = Math.max(0, Number(job.duration) || 0);
      const m = job.media;
      const nodes = [];
      let video = null;
      let snd = null;
      let card = null;
      let finished = false;

      const end = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (card) window.ActionCard.hide(card);
        for (const n of nodes) n.classList.add('gone');
        if (snd) snd.pause();
        setTimeout(() => { for (const n of nodes) n.remove(); if (video) video.pause(); resolve(); }, 450);
      };
      if (signal) signal.stop = end;

      if (m && m.builtin) {
        // الحركة المدمجة ترسم نفسها لنفس المدة، ونصها يظهر فقط إن لم تكن هناك بطاقة
        const showText = !(job.card && job.card.enabled) ? job.text || '' : '';
        playBuiltin({ ...m, duration: durS || m.duration || 6 }, showText);
      } else if (m && m.kind === 'video') {
        video = document.createElement('video');
        video.className = 'act';
        video.src = m.src;
        video.autoplay = true;
        video.playsInline = true;
        video.loop = durS > 0;
        video.muted = !!job.mute;
        video.volume = vol(job.volume);
        if (!durS) { video.onended = end; video.onerror = end; }
        video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
        stage.append(video);
        nodes.push(video);
      } else if (m && m.src) {
        const im = document.createElement('img');
        im.className = 'vimg act';
        im.src = m.src;
        stage.append(im);
        nodes.push(im);
      }
      if (job.sound) { snd = new Audio(job.sound); snd.volume = vol(job.soundVolume); snd.play().catch(() => {}); }
      if (job.card && job.card.enabled && window.ActionCard) {
        card = window.ActionCard.render(job.card, job.vars || {}, job.frame, { fonts });
        stage.append(card);
      }
      // بدون مدة: نهاية الفيديو، وإلا 5 ثوانٍ للصور والحركات
      const ms = durS ? durS * 1000 : m && m.kind === 'video' ? 120000 : 5000;
      const timer = setTimeout(end, ms);
    });
  }

  // ---------- الطابور ----------
  const queue = [];
  let busy = false;
  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const job = queue.shift();
      try {
        const vol = Math.max(0, Math.min(1, (job.volume === undefined ? 80 : Number(job.volume)) / 100));
        if (job.action) await playAction(job);
        else if (job.item.builtin) await playBuiltin(job.item, job.text);
        else await playMedia(job.item, job.text, vol);
      } catch (e) { console.error(e); }
      await sleep(250);
    }
    busy = false;
  }

  // معاينة المحرر: البرنامج يرسل الإجراء عبر postMessage، ونكرره حتى يتغيّر
  if (P.get('preview') === '1') {
    let current = null;
    let gen = 0;
    const sig = {};
    async function loop(job, g) {
      while (g === gen) {
        stage.replaceChildren();
        await playAction(job, sig);
        if (g !== gen) return;
        await sleep(700);
      }
    }
    addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'ld-preview') return;
      if (d.fonts) fonts = d.fonts;
      current = d.job;
      gen++;
      if (sig.stop) sig.stop();
      setTimeout(() => { if (current) loop(current, gen); }, 80);
    });
    return;
  }

  if (DEMO) {
    const item = { builtin: true, fx: P.get('fx') || 'stars', sub: P.get('sub') || '', color: P.get('c') || '#7c5cff', color2: P.get('c2') || '#ffffff', duration: Number(P.get('d')) || 6 };
    const text = P.get('text') || '';
    const go = () => playBuiltin(item, text, { still: P.get('still') === '1', loop: P.get('loop') === '1' });
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
    return;
  }

  // كل صفحة تعرض شاشتها فقط. الرابط القديم بدون ?screen يعمل كالشاشة 1 حتى لا تتعطل مصادر OBS الموجودة
  const MY_SCREEN = Number(P.get('screen')) || 1;
  const screenOfMsg = (m) => Number(m && m.screen) || 1;
  Overlay.on('valert', (d) => {
    if (!d || !d.item) return;
    if (screenOfMsg(d) !== MY_SCREEN) return;
    queue.push(d);
    pump();
  });
  // أصوات الإجراءات الموجّهة لهذه الشاشة (أصوات الشاشة الافتراضية تشغّلها alerts.html)
  Overlay.on('play-sound', (m) => {
    if (!m || !m.url || screenOfMsg(m) !== MY_SCREEN) return;
    const au = new Audio(m.url);
    au.play().catch(() => {});
  });
  // إجراءات «تنبيه مرئي» من صفحة الإجراءات
  Overlay.on('action-alert', (d) => {
    if (!d || screenOfMsg(d) !== MY_SCREEN) return;
    if (queue.length < 40) queue.push({ ...d, action: true });
    pump();
  });
  Overlay.on('snapshot', (s) => { if (s && s.widgets && s.widgets.fonts) fonts = s.widgets.fonts; });
  Overlay.on('valert-clear', () => { queue.length = 0; stage.replaceChildren(); });
})();
