(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d', { alpha: false });
  const RAMP = ' .·:-=+*#%@';
  const BITS = '01<>/\\|[]{}$#%&?!';
  const COLORS = ['#0d2a63', '#14479c', '#1d6ee0', '#2f97ff', '#38e1ff', '#d9f4ff'];
  let W = 0, H = 0, dpr = 1, cw = 12, ch = 18, cols = 0, rows = 0, cells = null;
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  const ripples = [];
  let t0 = performance.now(), running = true;

  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const base = W < 620 ? 11 : W > 1700 ? 16 : 13;
    cw = base; ch = Math.round(base * 1.55);
    cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
    cells = new Float32Array(cols * rows);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `600 ${Math.round(ch * .82)}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    if (reduce) draw(performance.now());
  }

  function field(x, y, t) {
    const nx = x / cols, ny = y / rows, a = cols / rows;
    let v = Math.sin(nx * 9 * a + t * .55 + Math.sin(ny * 6 + t * .4) * 1.6);
    v += Math.sin(ny * 11 - t * .7 + Math.sin(nx * 5 * a - t * .3) * 2.1);
    v += Math.sin((nx * a + ny) * 7 + t * .35);
    const dx = (nx - .5) * a, dy = ny - .5;
    v += Math.sin(Math.sqrt(dx * dx + dy * dy) * 16 - t * 1.1);
    return v / 4 * .5 + .5;
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * .18; pointer.y += (pointer.ty - pointer.y) * .18;
    ctx.fillStyle = '#03050b'; ctx.fillRect(0, 0, W, H);
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t > 2.4) ripples.splice(i, 1);
    const buckets = COLORS.map(() => []);
    const mcx = pointer.x / cw, mcy = pointer.y / ch;
    const assemble = reduce ? 99 : t;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Revelación inicial: los caracteres nacen desordenados y se ensamblan del centro hacia fuera.
        const dcx = (x - cols / 2) / cols, dcy = (y - rows / 2) / rows;
        const settle = .35 + Math.sqrt(dcx * dcx * 1.6 + dcy * dcy) * 2.2 + hash(x, y) * .6;
        let v = field(x, y, t);
        v = Math.pow(Math.max(0, v - .12) / .88, 1.5) * .78;
        const md = Math.hypot(x - mcx, (y - mcy) * (ch / cw));
        v += Math.exp(-md * md / 60) * .75;
        for (const r of ripples) {
          const rr = (t - r.t) * 34, d = Math.hypot(x - r.x, (y - r.y) * (ch / cw)) - rr;
          v += Math.exp(-d * d / 9) * (1 - (t - r.t) / 2.4) * 1.1;
        }
        if (v < .07 && assemble > settle) continue;
        let ch_;
        let lvl;
        if (assemble < settle) {
          if (hash(y + 3, x) > .5) continue;
          ch_ = BITS[(hash(x + Math.floor(t * 14), y) * BITS.length) | 0];
          lvl = (hash(y, x) * 3) | 0;
          if (assemble > settle - .35) lvl = 4;
        } else {
          const k = Math.min(1, v);
          ch_ = RAMP[Math.min(RAMP.length - 1, (k * RAMP.length) | 0)];
          if (k > .82 && hash(x, y + Math.floor(t * 3)) > .8) ch_ = BITS[(hash(y, x) * BITS.length) | 0];
          lvl = Math.min(5, (k * 6) | 0);
        }
        if (ch_ !== ' ') buckets[lvl].push(ch_, x * cw, y * ch);
      }
    }
    for (let b = 0; b < buckets.length; b++) {
      const a = buckets[b]; if (!a.length) continue;
      ctx.fillStyle = COLORS[b];
      for (let i = 0; i < a.length; i += 3) ctx.fillText(a[i], a[i + 1], a[i + 2]);
    }
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    requestAnimationFrame(loop);
  }

  function pulse(x, y) { ripples.push({ x: x / cw, y: y / ch, t: (performance.now() - t0) / 1000 }); }
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { pointer.tx = e.clientX; pointer.ty = e.clientY; }, { passive: true });
  addEventListener('pointerdown', e => { pointer.tx = pointer.x = e.clientX; pointer.ty = pointer.y = e.clientY; pulse(e.clientX, e.clientY); }, { passive: true });
  addEventListener('pointerleave', () => { pointer.tx = pointer.ty = -9999; });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduce) requestAnimationFrame(loop);
  });
  resize();
  if (!reduce) requestAnimationFrame(loop);

  // ---- Texto que se descifra ----
  const GLY = '01<>/\\|[]{}$#%&?!*+=-_';
  function scramble(el, delay = 0, dur = 900) {
    const nodes = [], walk = n => n.childNodes.forEach(c => c.nodeType === 3 ? nodes.push(c) : walk(c));
    walk(el);
    const finals = nodes.map(n => n.nodeValue);
    if (reduce) return;
    const total = finals.reduce((s, f) => s + f.length, 0);
    const start = performance.now() + delay;
    const step = now => {
      const p = Math.max(0, Math.min(1, (now - start) / dur));
      let seen = 0;
      nodes.forEach((n, i) => {
        n.nodeValue = [...finals[i]].map(chr => {
          const idx = seen++;
          if (chr === ' ' || chr === '\n') return chr;
          return p * total > idx ? chr : GLY[(Math.random() * GLY.length) | 0];
        }).join('');
      });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- Revelación de la página ----
  const items = [...document.querySelectorAll('.frag')];
  items.forEach((el, i) => {
    const r = n => (Math.random() * 2 - 1) * n;
    el.style.setProperty('--d', (0.45 + i * 0.13).toFixed(2) + 's');
    el.style.setProperty('--fx', r(90).toFixed(0) + 'px');
    el.style.setProperty('--fy', (30 + Math.random() * 50).toFixed(0) + 'px');
    el.style.setProperty('--fr', r(5).toFixed(1) + 'deg');
    el.style.setProperty('--c1', (Math.random() * 40).toFixed(0) + '%');
    el.style.setProperty('--c2', (40 + Math.random() * 40).toFixed(0) + '%');
    el.style.setProperty('--c3', (20 + Math.random() * 40).toFixed(0) + '%');
    el.style.setProperty('--c4', (10 + Math.random() * 40).toFixed(0) + '%');
  });
  const go = () => {
    document.body.classList.add('go');
    document.querySelectorAll('[data-scramble]').forEach((el, i) => scramble(el, 500 + i * 140, 1000));
    setTimeout(() => document.querySelector('h1')?.classList.add('glitch'), 3500);
  };
  const logo = document.querySelector('.logo-wrap img');
  if (logo && !logo.complete) { logo.addEventListener('load', go, { once: true }); logo.addEventListener('error', go, { once: true }); setTimeout(go, 1500); }
  else go();

  // ---- Interacción: tilt 3D + foco de luz en cada enlace, parallax del logo ----
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    document.querySelectorAll('.link').forEach(a => {
      a.addEventListener('pointermove', e => {
        const r = a.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        a.style.setProperty('--mx', px * 100 + '%'); a.style.setProperty('--my', py * 100 + '%');
        a.style.transform = `perspective(700px) rotateX(${((.5 - py) * 9).toFixed(2)}deg) rotateY(${((px - .5) * 11).toFixed(2)}deg) translateZ(6px)`;
      });
      a.addEventListener('pointerleave', () => { a.style.transform = ''; });
      a.addEventListener('pointerenter', () => { const s = a.querySelector('small'); if (s) scramble(s, 0, 450); });
    });
    const lw = document.querySelector('.logo-wrap');
    addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      lw.style.transform = `rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
    }, { passive: true });
  }
  document.querySelectorAll('.link').forEach(a => a.addEventListener('pointerdown', e => pulse(e.clientX, e.clientY), { passive: true }));

  // Same-origin request: the server assigns an anonymous, short-lived session cookie.
  if (!navigator.webdriver) fetch('/api/track', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
})();
