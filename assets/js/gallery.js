/* ==========================================================================
   gallery.js — the ribbon of plates between the hero and the works.

   Twelve plates ride a tilted circle. Each one is a separate procedural
   matte: a violet base pushed around by a low-resolution value-noise field,
   then blown back up so the plate reads as a surface rather than a swatch.
   The plates are drawn as quads — the ring gives the centre, and the two
   in-plane axes give the edges — so a plate near the viewer is larger and a
   plate at the far side is smaller, and the whole ring sorts back to front.

   Each plate is stamped with one ray of the mark: twelve plates, twelve rays,
   and on the seventh the single dot that walked out of the gap. That is what
   the ring is for — it is the logo, unfolded, so the object on the way to the
   works is the same object as the one at the top of the page.

   It drifts on its own, picks up speed under the pointer, and can be thrown.
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('galleryCanvas');
  if (!cv) return;
  var host = cv.parentNode;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* ---- the ring -------------------------------------------------------- */
  var N = 12;
  var RATIO = 0.36;        /* semi-minor / semi-major  →  the plane's tilt */
  var AXIS = 16;           /* screen angle of the major axis, degrees       */
  var DIST = 9;            /* camera distance, in ring radii                */
  var TILE = 0.48;         /* plate width, as a fraction of the ring radius */
  var ASPECT = 0.78;       /* plate height / width                          */
  var CORNER = 0.19;       /* corner radius, as a fraction of the side      */
  var PHASE = 93;          /* which plate starts where                      */
  var DUR = 15;            /* seconds per revolution at rate 1              */
  var IDLE = 0.78, HOT = 2.4;
  var TRAY = 1.10;         /* the plate the ribbons sit on, in ring radii   */
  var GAP = 0.020;         /* how much of the band is left empty, as a
                              fraction of its short side — this is the number
                              that used to be a clip                          */

  /* twelve plates. The range is deliberately wide — it is what makes the
     ribbon read as twelve different surfaces instead of one violet bead chain */
  var PLATES = [
    '#2C1A52', '#8A63EC', '#130B24', '#B98CFF', '#3E2472', '#E4DBFF',
    '#1B1130', '#6440C6', '#241640', '#CDBEF0', '#4A2C86', '#1A1030'
  ];

  var TS = 512;

  /* ---------------------------------------------------------------- noise */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function noiseField(seed) {
    var g = new Float32Array(4096), r = rng(seed), i;
    for (i = 0; i < 4096; i++) g[i] = r();
    return function (x, y) {
      var x0 = Math.floor(x), y0 = Math.floor(y);
      var fx = x - x0, fy = y - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var ra = (y0 & 63) * 64, rb = ((y0 + 1) & 63) * 64;
      var ca = x0 & 63, cb = (x0 + 1) & 63;
      var a = g[ra + ca], b = g[ra + cb], c = g[rb + ca], d = g[rb + cb];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  function fbm(n, x, y, oct) {
    var v = 0, amp = 0.5, f = 1, tot = 0, i;
    for (i = 0; i < oct; i++) { v += amp * n(x * f, y * f); tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  }

  function hexRGB(h) {
    var v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function mixRGB(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function mkc(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  var grainTile = (function () {
    var c = mkc(140, 140), x = c.getContext('2d');
    var d = x.createImageData(140, 140), r = rng(0x51F3);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = 128 + (r() - 0.5) * 116;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return c;
  })();

  function grain(x, alpha) {
    x.save();
    x.globalCompositeOperation = 'overlay';
    x.globalAlpha = alpha;
    x.fillStyle = x.createPattern(grainTile, 'repeat');
    x.fillRect(0, 0, TS, TS);
    x.restore();
  }

  function roundRect(x, w, h, r) {
    x.beginPath();
    x.moveTo(-w / 2 + r, -h / 2);
    x.lineTo(w / 2 - r, -h / 2); x.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    x.lineTo(w / 2, h / 2 - r);  x.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    x.lineTo(-w / 2 + r, h / 2); x.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    x.lineTo(-w / 2, -h / 2 + r); x.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    x.closePath();
  }

  /* ---- one ray of the mark, stamped on a plate ------------------------- */
  /* The dot grid is what the rest of the site is made of, so the ray is drawn
     the same way: a line of dots, not a stroke. */
  function stampRay(x, base, i) {
    var lum = (0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2]) / 255;
    /* white dots disappear on the pale plates; invert against the surface */
    var ink = lum > 0.55 ? '18,10,34' : '237,233,248';
    var a = (i * 30 - 90) * Math.PI / 180;
    var cx = TS / 2, cy = TS / 2;
    var dx = Math.cos(a), dy = Math.sin(a);

    function dot(px, py, r, al) {
      x.beginPath();
      x.arc(px, py, r, 0, TAU);
      x.fillStyle = 'rgba(' + ink + ',' + al + ')';
      x.fill();
    }

    if (i === 7) {
      /* the one that left: a single point, out past where the ray would end */
      dot(cx + dx * TS * 0.36, cy + dy * TS * 0.36, TS * 0.030, 0.95);
      dot(cx + dx * TS * 0.36, cy + dy * TS * 0.36, TS * 0.072, 0.13);
      return;
    }

    /* The ray runs off the plate. That is the point: each plate is holding one
       arm of the mark, cut off by the edge of the panel it landed on. */
    var half = TS / 2;
    var r0 = half * 0.17, r1 = half * 1.02, n = 7;
    for (var k = 0; k <= n; k++) {
      var t = k / n;
      var r = r0 + (r1 - r0) * t;
      /* thicker at the hub, thinner at the tip — the mark's rays are not
         uniform, and even dots read as a dashed line */
      var rad = half * (0.050 - 0.020 * t);
      dot(cx + dx * r, cy + dy * r, rad, 0.40 + 0.46 * (1 - t * 0.55));
    }
  }

  /* ---- one plate ------------------------------------------------------- */
  function paintPlate(x, base, i) {
    var n = noiseField(0x2C41 + i * 9176);
    var hi = mixRGB(base, [255, 248, 255], 0.15);
    var lo = mixRGB(base, [4, 2, 10], 0.19);

    /* paint small, blow up smooth: the field is a surface, not a texture */
    var N2 = 150;
    var buf = mkc(N2, N2), bx = buf.getContext('2d');
    var d = bx.createImageData(N2, N2), o, c, s;
    for (var py = 0; py < N2; py++) {
      for (var px = 0; px < N2; px++) {
        var u = (px + 0.5) / N2, v = (py + 0.5) / N2;
        s = 0.5 + (fbm(n, u * 7.2, v * 7.2, 5) - 0.5) * 1.15;
        /* one slow rise across the plate, so no two plates light the same */
        s += (0.5 - v) * 0.10 + (u - 0.5) * 0.06;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        c = s < 0.5 ? mixRGB(lo, base, s * 2) : mixRGB(base, hi, (s - 0.5) * 2);
        o = (py * N2 + px) * 4;
        d.data[o] = c[0] | 0; d.data[o + 1] = c[1] | 0; d.data[o + 2] = c[2] | 0; d.data[o + 3] = 255;
      }
    }
    bx.putImageData(d, 0, 0);
    x.imageSmoothingEnabled = true;
    x.drawImage(buf, 0, 0, TS, TS);

    grain(x, 0.10);
    stampRay(x, base, i);

    /* a lit top edge — a flat plate under one light source */
    var g = x.createLinearGradient(0, 0, 0, TS);
    g.addColorStop(0, 'rgba(255,250,255,0.10)');
    g.addColorStop(0.16, 'rgba(255,250,255,0)');
    g.addColorStop(0.86, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    x.fillStyle = g;
    x.fillRect(0, 0, TS, TS);
  }

  function bakePlate(base, i) {
    var c = mkc(TS, TS), x = c.getContext('2d');
    paintPlate(x, base, i);

    /* the corner is cut into the texture once, so the frame only ever has to
       transform and blit — no clip() per plate per frame */
    x.globalCompositeOperation = 'destination-in';
    x.translate(TS / 2, TS / 2);
    roundRect(x, TS, TS, TS * CORNER);
    x.fillStyle = '#fff';
    x.fill();
    return c;
  }

  function bakeBack(front) {
    var c = mkc(TS, TS), x = c.getContext('2d');
    x.drawImage(front, 0, 0);
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = 'rgba(128,128,128,0.25)';
    x.fillRect(0, 0, TS, TS);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgba(10,8,22,0.44)';
    x.fillRect(0, 0, TS, TS);
    return c;
  }

  var FRONT = [], BACK = [];

  /* ---- ring basis ------------------------------------------------------ */
  var ax = AXIS * Math.PI / 180;
  var cf = RATIO, sf = Math.sqrt(1 - cf * cf);
  var U = [Math.cos(ax), Math.sin(ax), 0];
  var V = [-Math.sin(ax) * cf, Math.cos(ax) * cf, sf];
  var AXV = [
    U[1] * V[2] - U[2] * V[1],
    U[2] * V[0] - U[0] * V[2],
    U[0] * V[1] - U[1] * V[0]
  ];

  /* ---- the quad, before the viewport scale ----------------------------- */
  /* Everything here is in units of A, the ring radius, so the same numbers can
     be measured once and drawn at any size. */
  function quad(psi) {
    var c = Math.cos(psi), s = Math.sin(psi);
    var C = [c * U[0] + s * V[0], c * U[1] + s * V[1], c * U[2] + s * V[2]];
    var T = [-s * U[0] + c * V[0], -s * U[1] + c * V[1], -s * U[2] + c * V[2]];
    var hw = TILE / 2;
    var hh = hw * ASPECT;

    function pr(x, y, z) {
      var k = DIST / (DIST - z);
      return [k * x, k * y];
    }
    var p0 = pr(C[0], C[1], C[2]);
    var pT = pr(C[0] + T[0] * hw, C[1] + T[1] * hw, C[2] + T[2] * hw);
    var pA = pr(C[0] + AXV[0] * hh, C[1] + AXV[1] * hh, C[2] + AXV[2] * hh);

    return {
      x: p0[0], y: p0[1],
      ex: pT[0] - p0[0], ey: pT[1] - p0[1],
      fx: pA[0] - p0[0], fy: pA[1] - p0[1],
      z: C[2], face: Math.abs(C[2])
    };
  }

  /* The old fit was an estimate — "roughly a quarter plate past the ellipse" —
     and it was wrong by enough that the near plates were cut off by the band.
     The true extent is cheap to measure: sample the whole revolution at unit
     scale and take the extremes. Because the projection is linear in A, one
     measurement holds at every size. */
  var EXTENT = (function () {
    var mx = TRAY, my = TRAY * RATIO;      /* start with the tray itself */
    for (var k = 0; k < 24; k++) {
      var turn = k * TAU / 24;
      for (var i = 0; i < N; i++) {
        var q = quad(PHASE * Math.PI / 180 - i * TAU / N + turn);
        for (var sx = -1; sx <= 1; sx += 2) {
          for (var sy = -1; sy <= 1; sy += 2) {
            var x = Math.abs(q.x + sx * q.ex + sy * q.fx);
            var y = Math.abs(q.y + sx * q.ey + sy * q.fy);
            if (x > mx) mx = x;
            if (y > my) my = y;
          }
        }
      }
    }
    return { x: mx, y: my };
  })();

  /* ---- viewport -------------------------------------------------------- */
  var W = 0, H = 0, A = 1, CX = 0, CY = 0, DPR = 1;
  var rate = IDLE, angle = 0, spin = 0, prev = 0, running = false, raf = 0, hot = false;

  function resize() {
    var r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width * DPR);
    H = Math.round(r.height * DPR);
    cv.width = W;
    cv.height = H;
    CX = W / 2;
    CY = H / 2;
    var padX = 10 * DPR, padY = Math.max(GAP * Math.min(W, H), 8 * DPR);
    A = Math.min((W / 2 - padX) / EXTENT.x, (H / 2 - padY) / EXTENT.y);
  }

  /* ---- the tray -------------------------------------------------------- */
  /* Without a surface under them the plates read as twelve floating tiles.
     A nearly invisible disc is enough to make the ring a thing — the eye uses
     the rim as a horizon. */
  function drawTray() {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(ax);
    ctx.scale(1, RATIO);

    var r = A * TRAY;
    var g = ctx.createRadialGradient(0, 0, r * 0.18, 0, 0, r);
    g.addColorStop(0, 'rgba(154,107,255,0.10)');
    g.addColorStop(0.62, 'rgba(120,80,220,0.045)');
    g.addColorStop(1, 'rgba(120,80,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.lineWidth = Math.max(1, 1.1 * DPR);
    ctx.strokeStyle = 'rgba(201,168,255,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(201,168,255,0.07)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.70, 0, TAU);
    ctx.stroke();

    ctx.restore();
  }

  function drawPlate(q, img) {
    if (Math.abs(q.ex * q.fy - q.ey * q.fx) < 0.5 / (A * A)) return;   /* edge on */

    /* a plate whose face is turned away from the eye is a sliver, and a sliver
       that is also bright reads as a rendering fault — fade it out instead */
    var alpha = (q.face - 0.05) / 0.16;
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha * alpha;

    ctx.setTransform(
      A * q.ex * 2 / TS, A * q.ey * 2 / TS,
      A * q.fx * 2 / TS, A * q.fy * 2 / TS,
      CX + A * q.x, CY + A * q.y
    );
    ctx.drawImage(img, -TS / 2, -TS / 2, TS, TS);
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!FRONT.length) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';

    drawTray();

    var list = [], i;
    for (i = 0; i < N; i++) {
      var psi = PHASE * Math.PI / 180 - i * TAU / N + angle;
      var q = quad(psi);
      q.i = i;
      list.push(q);
    }
    list.sort(function (a, b) { return a.z - b.z; });   /* far first */

    for (i = 0; i < list.length; i++) {
      drawPlate(list[i], (list[i].z > 0 ? FRONT : BACK)[list[i].i]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---- clock ----------------------------------------------------------- */
  function frame(now) {
    if (!running) return;
    var dt = Math.min(64, now - prev) / 1000;
    prev = now;

    /* ease toward the target rate so hovering in and out never snaps */
    var want = hot ? HOT : IDLE;
    rate += (want - rate) * Math.min(1, dt / 0.45);

    if (!dragging) {
      angle = (angle + dt * (rate * TAU / DUR + spin)) % TAU;
      /* the throw decays; below the idle rate it is indistinguishable anyway */
      spin *= Math.exp(-2.6 * dt);
      if (Math.abs(spin) < 0.012) spin = 0;
    }

    render();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || REDUCED) return;
    running = true;
    prev = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---- build ----------------------------------------------------------- */
  /* twelve 512px plates plus twelve darkened backs is about 12 MB of canvas
     and a good chunk of a frame budget. It is not worth paying at load for a
     band that sits below the fold, so the textures are baked the first time
     the band is actually about to be seen. */
  var built = false;
  function build() {
    if (built) return;
    built = true;
    for (var p = 0; p < PLATES.length; p++) {
      var front = bakePlate(hexRGB(PLATES[p]), p);
      FRONT.push(front);
      BACK.push(bakeBack(front));
    }
  }

  resize();

  /* ---- pointer + drag -------------------------------------------------- */
  /* A once-per-frame loop that never responds to anything is a screen saver.
     Letting it be thrown costs ten lines and gives the ring a reason to exist
     in the page: it is the one thing here you can push. */
  var dragging = false, dragX = 0, dragT = 0, dragMoved = 0;

  function touched() {
    if (host.classList.contains('is-touched')) return;
    host.classList.add('is-touched');
  }

  host.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    dragX = e.clientX;
    dragT = performance.now();
    dragMoved = 0;
    spin = 0;
    hot = true;
    host.classList.add('is-dragging');
    try { host.setPointerCapture(e.pointerId); } catch (err) {}
    start();
  });

  host.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') hot = true;
    if (!dragging) return;
    var now = performance.now();
    var dx = e.clientX - dragX;
    var dt = Math.max(8, now - dragT);
    dragX = e.clientX;
    dragT = now;
    dragMoved += Math.abs(dx);

    /* radians per pixel: a full drag across the band is about a third of a
       revolution, which is enough to feel connected without feeling loose */
    var d = dx * 0.0042;
    angle = (angle + d) % TAU;
    /* low-pass the throw: one jittery last frame should not become the fling */
    spin = spin * 0.55 + (d / (dt / 1000)) * 0.45;
    if (Math.abs(dragMoved) > 4) touched();
    render();
  }, { passive: true });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    host.classList.remove('is-dragging');
    /* a real flick keeps its momentum; a slow nudge should not */
    if (Math.abs(spin) < 0.35) spin = 0;
    if (e && e.pointerType === 'touch') {
      setTimeout(function () { hot = false; }, 700);
    }
  }
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  host.addEventListener('pointerenter', function () { hot = true; start(); });
  host.addEventListener('pointerleave', function () {
    hot = false;
    endDrag();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) { stop(); return; }
      build();
      render();
      start();
    }, { threshold: 0 }).observe(host);
  } else {
    build();
    render();
    start();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!document.hidden) start();
  });

  var q = 0;
  window.addEventListener('resize', function () {
    clearTimeout(q);
    q = setTimeout(function () { resize(); render(); }, 160);
  }, { passive: true });

  window.__gallery = {
    plates: function () { return FRONT.length; },
    angle: function () { return angle; },
    fit: function () { return { A: A, extent: EXTENT, W: W, H: H }; }
  };
})();
