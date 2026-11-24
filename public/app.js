(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d', { alpha: false });
  const fx = document.getElementById('fx');
  const fctx = fx.getContext('2d');
  const RAMP = ' .·:-=+*#%@';
  const BITS = '01<>/\\|[]{}$#%&?!';
  const COLORS = ['#0d2a63', '#14479c', '#1d6ee0', '#2f97ff', '#38e1ff', '#d9f4ff'];
  let W = 0, H = 0, dpr = 1, cw = 12, ch = 18, cols = 0, rows = 0;
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  const ripples = [];
  let t0 = performance.now(), running = true, lastDraw = 0, intro = null;

  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const FONT = 'ui-monospace, Menlo, Consolas, monospace';

  // Ajusta el tamaño del escenario (todo está en rem) para llenar la pantalla en cualquier dispositivo
  const stage = document.querySelector('.stage');
  function fit() {
    const de = document.documentElement, fs = parseFloat(getComputedStyle(de).fontSize) || 16;
    const r = stage.getBoundingClientRect(), w = r.width / fs, h = r.height / fs;
    const v = Math.min(innerWidth * .94 / w, innerHeight * .95 / h);
    de.style.fontSize = Math.max(9, Math.min(22, v)).toFixed(2) + 'px';
  }

  function resize() {
    fit();
    dpr = Math.min(devicePixelRatio || 1, 1.25);
    W = innerWidth; H = innerHeight;
    for (const c of [canvas, fx]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const base = Math.max(10, Math.min(16, Math.round(Math.min(W, H) / 30)));
    cw = base; ch = Math.round(base * 1.55);
    cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
    for (const c of [ctx, fctx]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.font = `600 ${Math.round(ch * .82)}px "JetBrains Mono", ${FONT}`;
      c.textBaseline = 'top';
    }
    if (splash) placeSplash();
    if (intro && !intro.done) finishIntro();
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
    pointer.x += (pointer.tx - pointer.x) * .3; pointer.y += (pointer.ty - pointer.y) * .3;
    ctx.fillStyle = '#03050b'; ctx.fillRect(0, 0, W, H);
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t > 2.4) ripples.splice(i, 1);
    const buckets = COLORS.map(() => []);
    const mcx = pointer.x / cw, mcy = pointer.y / ch, asp = ch / cw;
    const assemble = reduce ? 99 : t;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dcx = (x - cols / 2) / cols, dcy = (y - rows / 2) / rows;
        const settle = .15 + Math.sqrt(dcx * dcx * 1.6 + dcy * dcy) * 1.1 + hash(x, y) * .35;
        let v = field(x, y, t);
        v = Math.pow(Math.max(0, v - .12) / .88, 1.5) * .78;
        const md = Math.hypot(x - mcx, (y - mcy) * asp);
        v += Math.exp(-md * md / 60) * .75;
        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i], d = Math.hypot(x - r.x, (y - r.y) * asp) - (t - r.t) * 34;
          v += Math.exp(-d * d / 9) * (1 - (t - r.t) / 2.4) * 1.1;
        }
        let c, lvl;
        if (assemble < settle) {
          if (hash(y + 3, x) > .5) continue;
          c = BITS[(hash(x + Math.floor(t * 14), y) * BITS.length) | 0];
          lvl = (hash(y, x) * 3) | 0;
        } else {
          if (v < .07) continue;
          const k = Math.min(1, v);
          c = RAMP[Math.min(RAMP.length - 1, (k * RAMP.length) | 0)];
          if (k > .82 && hash(x, y + Math.floor(t * 3)) > .8) c = BITS[(hash(y, x) * BITS.length) | 0];
          lvl = Math.min(5, (k * 6) | 0);
        }
        if (c !== ' ') buckets[lvl].push(c, x * cw, y * ch);
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
    requestAnimationFrame(loop);
    if (splash) {
      try { drawSplash(now); } catch (e) { endSplash(true); }
      if (splash && splash.solid) return;              // mientras el QR tapa la pantalla no hace falta dibujar el fondo
    }
    const live = intro && !intro.done;
    if (live) drawIntro(now);                          // la intro va a 60fps
    if ((!live || splash) && now - lastDraw < 33) return; // el fondo va a ~30fps para no pesar
    lastDraw = now;
    draw(now);
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

  // ---------- Intro: logo, nombre y botones nacen como ASCII del fondo y se fragmentan hasta su forma ----------
  const targets = [
    { el: document.querySelector('.logo-wrap'), kind: 'img', at: .7 },
    { el: document.querySelector('.hello'), kind: 'text', at: .85 },
    { el: document.querySelector('h1'), kind: 'text', at: .95 },
    { el: document.querySelector('.role'), kind: 'text', at: 1.1 },
    ...[...document.querySelectorAll('.links > li')].map((el, i) => ({ el, kind: 'card', at: 1.2 + i * .13 }))
  ];

  function rasterize(tg) {
    const r = tg.el.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor(r.left / cw) - 1), y0 = Math.max(0, Math.floor(r.top / ch) - 1);
    const x1 = Math.min(cols, Math.ceil(r.right / cw) + 1), y1 = Math.min(rows, Math.ceil(r.bottom / ch) + 1);
    const pw = (x1 - x0) * cw, ph = (y1 - y0) * ch, ox = x0 * cw, oy = y0 * ch;
    const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.textBaseline = 'middle';
    const chars = (node, color) => {
      const cs = getComputedStyle(node);
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      c.fillStyle = color || cs.color;
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const st = n.parentElement === node ? null : getComputedStyle(n.parentElement).color;
        if (st) c.fillStyle = color || st; else c.fillStyle = color || cs.color;
        const rg = document.createRange(), s = n.nodeValue;
        for (let i = 0; i < s.length; i++) {
          if (s[i] === ' ' || s[i] === '\n') continue;
          rg.setStart(n, i); rg.setEnd(n, i + 1);
          const b = rg.getBoundingClientRect();
          c.fillText(s[i], b.left - ox, b.top + b.height / 2 - oy);
        }
      }
    };
    let boost = 1;
    if (tg.kind === 'img') {
      const im = tg.el.querySelector('img');
      c.drawImage(im, r.left - ox, r.top - oy, r.width, r.height);
    } else if (tg.kind === 'text') {
      chars(tg.el); boost = 2.4;
    } else {
      const a = tg.el.querySelector('a'), acc = getComputedStyle(a).getPropertyValue('--a').trim() || '#38aaff';
      const ar = a.getBoundingClientRect();
      c.fillStyle = acc; c.globalAlpha = .06; c.beginPath(); c.roundRect(ar.left - ox, ar.top - oy, ar.width, ar.height, 16); c.fill();
      c.globalAlpha = 1; c.lineWidth = 3; c.strokeStyle = acc; c.stroke();
      const ir = a.querySelector('.ico').getBoundingClientRect();
      c.globalAlpha = .4; c.fillRect(ir.left - ox, ir.top - oy, ir.width, ir.height); c.globalAlpha = 1;
      chars(a.querySelector('strong'), '#fff'); chars(a.querySelector('small'), '#c7d6ea'); chars(a.querySelector('.arrow'), acc);
      boost = 1.9;
    }
    const data = c.getImageData(0, 0, pw, ph).data, out = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      let sa = 0, sr = 0, sg = 0, sb = 0;
      const px0 = (x - x0) * cw, py0 = (y - y0) * ch;
      for (let yy = 0; yy < ch; yy += 2) for (let xx = 0; xx < cw; xx += 2) {
        const i = ((py0 + yy) * pw + px0 + xx) * 4, a = data[i + 3];
        if (a) { sa += a; sr += data[i] * a; sg += data[i + 1] * a; sb += data[i + 2] * a; }
      }
      const n = (cw / 2) * (ch / 2) * 255, cov = Math.min(1, sa / n * boost);
      if (cov < .16 || !sa) continue;
      const k = 1.15;
      const col = `rgb(${Math.min(255, sr / sa * k) | 0},${Math.min(255, sg / sa * k) | 0},${Math.min(255, sb / sa * k) | 0})`;
      out.push({ x: x * cw, y: y * ch, c: RAMP[Math.min(RAMP.length - 1, 2 + ((cov * (RAMP.length - 2)) | 0))], col, r: hash(x, y * 1.7), s: hash(y, x + 9) });
    }
    tg.cells = out;
  }

  function drawIntro(now) {
    const t = (now - intro.start) / 1000;
    if (t < 0) return;
    fctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const tg of targets) {
      if (t >= tg.at && !tg.shown) { tg.shown = true; tg.el.classList.add('in'); }
      for (const q of tg.cells) {
        const settle = .08 + q.s * .5, gone = tg.at + q.r * .55;
        if (t >= gone + .2) continue;
        alive = true;
        let c = q.c, col = q.col;
        if (t < settle) { c = BITS[(hash(q.x + Math.floor(t * 18), q.y) * BITS.length) | 0]; col = '#2f97ff'; }
        else if (t >= gone) { c = BITS[(hash(q.y + Math.floor(t * 30), q.x) * BITS.length) | 0]; col = '#38e1ff'; }
        fctx.fillStyle = col; fctx.fillText(c, q.x, q.y);
      }
    }
    if (!alive && t > 1) finishIntro();
  }

  function finishIntro() {
    if (!intro || intro.done) return;
    intro.done = true; fctx.clearRect(0, 0, W, H); fx.style.display = 'none';
    targets.forEach(tg => tg.el.classList.add('in'));
    document.body.classList.add('go');
    document.querySelectorAll('.link').forEach(a => a.classList.add('pulse-on'));
  }

  // ---------- Splash: el QR de la tarjeta se escanea a pantalla completa y sus módulos arman el logo en su lugar ----------
  // QR real de https://morphiq-links.vercel.app (versión 2, 25×25). Si cambia el dominio, hay que generarlo de nuevo.
  const QR = ['1111111001110011001111111', '1000001010011101001000001', '1011101010001011101011101', '1011101010000001101011101', '1011101000010011001011101', '1000001001011000001000001', '1111111010101010101111111', '0000000011100010100000000', '1000001011010110011001110', '0101100010010101110011100', '0110111000000010110000011', '1111010111001110100111000', '1010111110001011101111110', '1001110101000010111001000', '1010111011011101110111100', '1011110000010011011000111', '1010011111110100111110101', '0000000011101111100011110', '1111111000010000101010111', '1000001000101010100011101', '1011101000101001111110001', '1011101001000010100110111', '1011101000111001110010101', '1000001001110001110011100', '1111111010101111111010011'];
  // Los tres cuadritos del símbolo dentro de logo.png (x, y, ancho, alto sobre 1254×335): ahí aterrizan los tres ojos del QR.
  const SQ = [[256, 64, 28, 32], [280, 38, 28, 31], [290, 74, 29, 32]], LOGO_W = 1254, LOGO_H = 335;
  const INK = [244, 247, 255], INK_CSS = '#f4f7ff', LIT = '#38e1ff';
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v, lerp = (a, b, k) => a + (b - a) * k;
  const pop = p => p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(8.5 * p);   // resorte con rebote corto
  const io2 = p => p < .5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2, io3 = p => p < .5 ? 4 * p * p * p : 1 - (2 - 2 * p) ** 3 / 2;
  const mix = (a, b, k) => `rgb(${lerp(a[0], b[0], k) | 0},${lerp(a[1], b[1], k) | 0},${lerp(a[2], b[2], k) | 0})`;
  const logoWrap = document.querySelector('.logo-wrap'), logoImg = logoWrap.querySelector('img');
  let splash = null;

  function startSplash() {
    const cv = document.createElement('canvas'); cv.id = 'qr'; cv.setAttribute('aria-hidden', 'true');
    const N = QR.length, eye = (r, k) => (r < 7 && k < 7) || (r < 7 && k >= N - 7) || (r >= N - 7 && k < 7);
    const mods = []; let dmax = 0;
    for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) if (QR[r][k] === '1' && !eye(r, k)) {
      const d = Math.hypot(k - (N - 1) / 2, r - (N - 1) / 2); dmax = Math.max(dmax, d);
      mods.push({ r, k, d });
    }
    for (const q of mods) q.t = .05 + q.d / dmax * .34 + hash(q.k + 2, q.r + 5) * .05;   // nacen del centro hacia afuera
    mods.sort((a, b) => a.k - b.k || a.r - b.r);
    splash = { cv, c: cv.getContext('2d'), N, mods, eyes: [[0, 0], [0, N - 7], [N - 7, 0]], land: [.66, .76, .86],
      start: performance.now(), solid: true, ready: false, read: null, fly: null, launched: false, handed: false, open: false, ov: -1,
      guard: setTimeout(() => endSplash(true), 12000) };                              // pase lo que pase, la página no se queda tapada
    cv.addEventListener('click', () => endSplash(true));                              // un toque la salta
    document.body.append(cv);
    placeSplash();
  }

  function placeSplash() {
    const s = splash, k = Math.min(devicePixelRatio || 1, 2);
    s.k = k; s.cv.width = Math.round(W * k); s.cv.height = Math.round(H * k);
    s.size = Math.min(W * .72, H * .5, 440); s.m = s.size / s.N; s.qx = (W - s.size) / 2; s.qy = (H - s.size) / 2;
  }

  // Con el logo ya cargado: una copia nítida para dibujarlo y una rejilla de celdas (con su color) donde aterrizan los módulos.
  function prepareSplash() {
    const s = splash;
    if (!logoImg.naturalWidth) throw new Error('logo');
    const r = logoImg.getBoundingClientRect(), w = Math.max(2, Math.round(r.width * s.k)), h = Math.max(2, Math.round(r.height * s.k));
    const full = document.createElement('canvas'); full.width = w; full.height = h;
    const fc = full.getContext('2d'); fc.imageSmoothingQuality = 'high'; fc.drawImage(logoImg, 0, 0, w, h);
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const gw = Math.max(40, Math.round(Math.min(120, r.width / 2.6))), gh = Math.max(4, Math.round(gw * r.height / r.width)), S = 4, sw = gw * S, sh = gh * S;
    const sm = document.createElement('canvas'); sm.width = sw; sm.height = sh;
    const sc = sm.getContext('2d', { willReadFrequently: true }); sc.imageSmoothingQuality = 'high'; sc.drawImage(logoImg, 0, 0, sw, sh);
    const d = sc.getImageData(0, 0, sw, sh).data;
    const avg = (x0, y0, x1, y1) => {
      let sa = 0, sr = 0, sg = 0, sb = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * sw + x) * 4, a = d[i + 3]; sa += a; sr += d[i] * a; sg += d[i + 1] * a; sb += d[i + 2] * a; }
      return sa ? [sr / sa, sg / sa, sb / sa, sa / ((x1 - x0) * (y1 - y0) * 255)] : [0, 0, 0, 0];
    };
    const cells = [];
    for (let i = 0; i < gw; i++) for (let j = 0; j < gh; j++) {
      const u = (i + .5) / gw, v = (j + .5) / gh, px = u * LOGO_W, py = v * LOGO_H;
      if (SQ.some(q => px > q[0] - 3 && px < q[0] + q[2] + 3 && py > q[1] - 3 && py < q[1] + q[3] + 3)) continue;   // los cuadritos los ponen los ojos
      const a = avg(i * S, j * S, (i + 1) * S, (j + 1) * S);
      if (a[3] < .34) continue;
      cells.push({ u, v, col: [Math.min(255, a[0] * 1.12), Math.min(255, a[1] * 1.12), Math.min(255, a[2] * 1.12)],
        dt: u * .42 + hash(i + 1, j + 7) * .1, dur: .42 + hash(j + 3, i + 11) * .16, bend: (hash(i + 5, j + 2) - .5) * .22 });
    }
    if (!cells.length) throw new Error('logo');
    cells.forEach((q, i) => { q.src = s.mods[Math.floor(i * s.mods.length / cells.length)]; });   // de izquierda a derecha: cada módulo se reparte en varias celdas
    s.sq = SQ.map(q => {
      const a = avg(Math.floor(q[0] / LOGO_W * sw), Math.floor(q[1] / LOGO_H * sh), Math.ceil((q[0] + q[2]) / LOGO_W * sw), Math.ceil((q[1] + q[3]) / LOGO_H * sh));
      return { u: q[0] / LOGO_W, v: q[1] / LOGO_H, w: q[2] / LOGO_W, h: q[3] / LOGO_H, col: a[3] ? a : [47, 151, 255] };
    });
    s.full = full; s.tmp = tmp; s.cells = cells; s.gw = gw; s.ready = true;
  }

  function launchSplash(now) {
    const s = splash;
    s.launched = true; s.solid = false;
    t0 = now;                                              // el fondo ASCII se arma mientras se destapa
    targets.shift();                                       // el logo lo arma el QR; lo demás conserva su intro ASCII, un poco adelantada
    try { targets.forEach(tg => { tg.at -= .45; rasterize(tg); }); intro = { start: now + 200, done: false }; }
    catch (e) { targets.forEach(tg => { tg.cells = tg.cells || []; }); intro = { start: now, done: false }; finishIntro(); }
  }

  function showLogo() {
    logoWrap.style.transition = 'none'; logoWrap.classList.add('in');
    requestAnimationFrame(() => requestAnimationFrame(() => { logoWrap.style.transition = ''; }));
  }

  function endSplash(skip) {
    const s = splash;
    if (!s) return;
    splash = null; clearTimeout(s.guard); s.cv.remove(); showLogo();
    if (!intro) { t0 = performance.now(); targets.forEach(tg => { tg.cells = tg.cells || []; }); intro = { start: t0, done: false }; skip = true; }
    if (skip) finishIntro();
  }

  function drawSplash(now) {
    const s = splash, c = s.c, { m, qx, qy, size } = s, t = (now - s.start) / 1000;
    // La lectura se da al terminar el barrido en curso y solo cuando el logo ya está listo: mientras carga, el QR se sigue escaneando.
    if (s.read === null && s.ready) { s.read = .95 + Math.max(0, Math.ceil((t - 1.45) / .62)) * .62 + .52; s.fly = s.read + .25; }
    if (s.read === null && t > 6) return endSplash(true);
    const tf = s.fly === null ? -1 : t - s.fly;            // segundos desde que los módulos despegan
    if (tf >= 0 && !s.launched) launchSplash(now);
    const ov = tf < 0 ? 1 : 1 - io2(c01((tf - .12) / .7));   // la página se destapa mientras los pixeles vuelan
    if (ov !== s.ov) { s.ov = ov; s.cv.style.background = `rgba(3,5,11,${ov.toFixed(3)})`; }
    c.setTransform(s.k, 0, 0, s.k, 0, 0); c.clearRect(0, 0, W, H);
    const lit = s.read !== null && t >= s.read && t < s.read + .22;
    let scan = -1;
    if (t >= .95 && (s.read === null || t < s.read - .02)) { const u = (t - .95) % .62; if (u <= .5) scan = io2(u / .5); }
    const R = tf >= 0 ? logoImg.getBoundingClientRect() : null;   // se sigue el logo real, por si la página se reacomoda

    if (tf > .52) { // el logo aparece de izquierda a derecha, al ritmo en que aterrizan los pixeles
      const tc = s.tmp.getContext('2d'), w = s.tmp.width, h = s.tmp.height, tt = tf - .52, sh = (tf - 1.3) / .6;
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, w, h); tc.drawImage(s.full, 0, 0);
      if (tt < .64) {
        const gr = tc.createLinearGradient((tt - .22) / .42 * w, 0, tt / .42 * w, 0);
        gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        tc.globalCompositeOperation = 'destination-in'; tc.fillStyle = gr; tc.fillRect(0, 0, w, h);
      }
      if (sh > 0 && sh < 1) { // un brillo cruza el logo ya formado
        const x = lerp(-.25, 1.25, io2(sh)) * w, bw = w * .1, gr = tc.createLinearGradient(x - bw, 0, x + bw, 0);
        gr.addColorStop(0, 'rgba(220,244,255,0)'); gr.addColorStop(.5, 'rgba(220,244,255,.6)'); gr.addColorStop(1, 'rgba(220,244,255,0)');
        tc.globalCompositeOperation = 'source-atop'; tc.setTransform(1, 0, -.4, 1, h * .2, 0); tc.fillStyle = gr; tc.fillRect(-w, 0, w * 3, h); tc.setTransform(1, 0, 0, 1, 0, 0);
      }
      tc.globalCompositeOperation = 'source-over';
      s.sq.forEach((q, i) => { if (tf < s.land[i] + .45) tc.clearRect(q.u * w, q.v * h, q.w * w, q.h * h); });
      c.globalAlpha = 1 - c01((tf - 1.98) / .25);
      c.drawImage(s.tmp, R.left, R.top, R.width, R.height);
      s.sq.forEach((q, i) => { // cada cuadrito cae como sello cuando llega su ojo
        const p = (tf - s.land[i]) / .45;
        if (p < 0 || p >= 1) return;
        const z = lerp(1.35, 1, pop(p)), qw = q.w * R.width, qh = q.h * R.height, cx = R.left + (q.u + q.w / 2) * R.width, cy = R.top + (q.v + q.h / 2) * R.height;
        c.drawImage(s.full, q.u * w, q.v * h, q.w * w, q.h * h, cx - qw * z / 2, cy - qh * z / 2, qw * z, qh * z);
      });
      c.globalAlpha = 1;
    }

    if (tf < 0) { // el código: los módulos nacen y se encienden al paso de la línea
      for (const q of s.mods) {
        const p = pop(c01((t - q.t) / .24));
        if (p <= 0) continue;
        const y = qy + (q.r + .5) * m, z = m * .92 * p;
        c.fillStyle = lit || (scan >= 0 && Math.abs(y - (qy + size * scan)) < m * 1.1) ? LIT : INK_CSS;
        c.fillRect(qx + (q.k + .5) * m - z / 2, y - z / 2, z, z);
      }
    } else { // el vuelo: cada celda sale de su módulo y cambia de tamaño y color hasta el suyo
      const g = R.width / s.gw * .94;
      for (const q of s.cells) {
        const sx = qx + (q.src.k + .5) * m, sy = qy + (q.src.r + .5) * m;
        if (tf < q.dt) { c.fillStyle = INK_CSS; c.fillRect(sx - m * .46, sy - m * .46, m * .92, m * .92); continue; }
        const a = 1 - c01((tf - q.u * .42 - .62) / .2);
        if (a <= 0) continue;
        const p = c01((tf - q.dt) / q.dur), e = io3(p), dx = R.left + q.u * R.width - sx, dy = R.top + q.v * R.height - sy, b = Math.sin(Math.PI * p) * q.bend, z = lerp(m * .92, g, e);
        c.globalAlpha = a; c.fillStyle = mix(INK, q.col, e);
        c.fillRect(sx + dx * e - dy * b - z / 2, sy + dy * e + dx * b - z / 2, z, z);
      }
      c.globalAlpha = 1;
    }

    s.eyes.forEach((E, i) => { // los tres ojos: marco y centro; se rellenan, vuelan girando y caen en los tres cuadritos
      const pin = pop(c01((t - .05 - i * .07) / .3));
      if (pin <= 0) return;
      const ex = qx + (E[1] + 3.5) * m, ey = qy + (E[0] + 3.5) * m, go = tf - .06 - i * .1;
      if (go < 0) {
        const o = 7 * m * pin, hole = 5 * m * pin * (1 - c01((tf + .08) / .12)), k = 3 * m * pin;
        c.fillStyle = lit ? LIT : INK_CSS;
        c.beginPath(); c.rect(ex - o / 2, ey - o / 2, o, o); if (hole > .5) c.rect(ex - hole / 2, ey - hole / 2, hole, hole); c.fill('evenodd');
        c.fillRect(ex - k / 2, ey - k / 2, k, k);
        return;
      }
      const q = s.sq[i], tx = R.left + (q.u + q.w / 2) * R.width, ty = R.top + (q.v + q.h / 2) * R.height, side = q.w * R.width;
      if (go < .6) {
        const p = go / .6, e = io3(p), dx = tx - ex, dy = ty - ey, b = Math.sin(Math.PI * p) * (i === 1 ? -.16 : .16), z = lerp(7 * m, side * 1.35, e);
        c.save(); c.translate(ex + dx * e - dy * b, ey + dy * e + dx * b); c.rotate(e * Math.PI / 2);
        c.fillStyle = mix(INK, q.col, e); c.fillRect(-z / 2, -z / 2, z, z); c.restore();
      } else if (go < 1.1) {
        const p = (go - .6) / .5, rr = side * (.7 + p * 1.7);
        c.globalAlpha = (1 - p) * .9; c.strokeStyle = LIT; c.lineWidth = 1.5; c.strokeRect(tx - rr, ty - rr, rr * 2, rr * 2); c.globalAlpha = 1;
      }
    });

    const vf = 1 - (1 - c01((t - .58) / .42)) ** 3, va = Math.min(1, vf * 2) * (tf < 0 ? 1 : 1 - c01(tf / .2));
    if (va > .01) { // visor: cuatro esquinas que se cierran sobre el código y lo aprietan al leerlo
      const snap = s.read === null ? 0 : Math.sin(Math.PI * c01((t - s.read) / .4));
      const mg = m * 1.7 + (1 - vf) * m * 5 - snap * m * .6, L = m * 3.2, x0 = qx - mg, y0 = qy - mg, x1 = qx + size + mg, y1 = qy + size + mg;
      c.globalAlpha = va; c.strokeStyle = lit ? '#d9f4ff' : '#3d9bff'; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0); c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
      c.moveTo(x1, y1 - L); c.lineTo(x1, y1); c.lineTo(x1 - L, y1); c.moveTo(x0 + L, y1); c.lineTo(x0, y1); c.lineTo(x0, y1 - L);
      c.stroke(); c.globalAlpha = 1;
    }
    if (scan >= 0) { // línea de lectura
      const y = qy + size * scan, gl = 14, gr = c.createLinearGradient(0, y - gl, 0, y + gl);
      gr.addColorStop(0, 'rgba(56,225,255,0)'); gr.addColorStop(.5, 'rgba(56,225,255,.45)'); gr.addColorStop(1, 'rgba(56,225,255,0)');
      c.fillStyle = gr; c.fillRect(qx - m * 2, y - gl, size + m * 4, gl * 2);
      c.fillStyle = '#ddf3ff'; c.fillRect(qx - m * 2, y - 1, size + m * 4, 2);
    }

    if (tf >= .9 && !s.open) { s.open = true; s.cv.style.pointerEvents = 'none'; }                            // ya asoman los botones: los toques pasan a la página
    if (tf >= 1.95 && !s.handed) { s.handed = true; showLogo(); }                                          // el logo real queda debajo y el dibujado se retira
    if (tf >= 2.25) endSplash(false);
  }

  // ---------- Reflejo ASCII, brillo y interacción ----------
  const SHEEN = '01<>/\\|[]{}$#%&*+=-:.';
  function decorate() {
    document.querySelectorAll('.link').forEach(a => {
      const el = document.createElement('span'); el.className = 'sheen'; el.setAttribute('aria-hidden', 'true');
      const n = (() => { const u = parseFloat(getComputedStyle(document.documentElement).fontSize) * .6875; return Math.ceil(a.offsetWidth / (u * .6)) * Math.ceil(a.offsetHeight / u); })();
      let str = ''; for (let i = 0; i < n; i++) str += SHEEN[(Math.random() * SHEEN.length) | 0];
      el.textContent = str; a.prepend(el);
      const p = document.createElement('span'); p.className = 'pulse'; p.setAttribute('aria-hidden', 'true'); a.append(p);
    });
  }

  const GLY = '01<>/\\|[]{}$#%&?!*+=-_';
  function scramble(el, dur = 450) {
    const node = el.firstChild, final = node.nodeValue, start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      node.nodeValue = [...final].map((c, i) => (c === ' ' || p * final.length > i) ? c : GLY[(Math.random() * GLY.length) | 0]).join('');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function interactions() {
    if (fine && !reduce) {
      document.querySelectorAll('.link').forEach(a => {
        a.addEventListener('pointermove', e => {
          const r = a.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          a.style.setProperty('--mx', px * 100 + '%'); a.style.setProperty('--my', py * 100 + '%');
          a.style.transform = `perspective(700px) rotateX(${((.5 - py) * 9).toFixed(2)}deg) rotateY(${((px - .5) * 11).toFixed(2)}deg) translateZ(6px)`;
        });
        a.addEventListener('pointerleave', () => { a.style.transform = ''; });
        a.addEventListener('pointerenter', () => { const s = a.querySelector('small'); if (s) scramble(s); });
      });
      const lw = document.querySelector('.logo-wrap');
      addEventListener('pointermove', e => {
        if (splash) return;                                // el logo se queda quieto mientras el QR lo arma
        const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
        lw.style.transform = `rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`;
      }, { passive: true });
    }
    document.querySelectorAll('.link').forEach(a => a.addEventListener('pointerdown', e => pulse(e.clientX, e.clientY), { passive: true }));
  }

  // ---------- Arranque ----------
  resize();
  decorate(); interactions();
  if (reduce) { targets.forEach(tg => tg.el.classList.add('in')); document.body.classList.add('go'); }
  else {
    requestAnimationFrame(loop);
    try { startSplash(); } catch (e) { splash = null; }    // el QR sale de inmediato y se escanea mientras cargan el logo y las fuentes
    const logo = document.querySelector('.logo-wrap img');
    const ready = Promise.all([
      Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]),
      logo.complete ? 0 : new Promise(r => { logo.onload = logo.onerror = r; setTimeout(r, splash ? 5000 : 1500); })
    ]);
    ready.then(() => {
      fit();
      if (splash) { try { prepareSplash(); } catch (e) { endSplash(true); } return; }
      if (intro) return;                                   // saltaron el splash antes de que cargara todo
      try { targets.forEach(rasterize); } catch (e) { targets.forEach(tg => tg.el.classList.add('in')); document.body.classList.add('go'); return; }
      t0 = performance.now();
      intro = { start: performance.now(), done: false };
    });
  }

  // Same-origin request: the server assigns an anonymous, short-lived session cookie.
  if (!navigator.webdriver) fetch('/api/track', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
})();
