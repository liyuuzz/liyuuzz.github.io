/* ==========================================================================
   gallery.js — the ribbon of plates between the hero and the works.

   Twelve plates ride a tilted circle. Each one is a separate procedural
   matte: a violet base pushed around by a low-resolution value-noise field,
   then blown back up so the plate reads as a surface rather than a swatch.
   The plates are drawn as quads — the ring gives the centre, and the two
   in-plane axes give the edges — so a plate near the viewer is larger and a
   plate at the far side is smaller, and the whole ring sorts back to front.

   It drifts on its own and picks up speed under the pointer. The band is
   masked at its edges in CSS, so the ribbon dissolves into the page instead
   of sitting in a rectangle.
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
  var IDLE = 0.42, HOT = 1.0;

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
  function cssRGB(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

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

  /* ---- viewport -------------------------------------------------------- */
  var W = 0, H = 0, A = 1, CX = 0, CY = 0, DPR = 1;
  var rate = IDLE, angle = 0, prev = 0, running = false, raf = 0, hot = false;

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
    /* fit the ribbon to the band. The plates stick out past the ellipse by
       roughly a quarter of a plate on every side, so the horizontal term
       allows for that; the vertical term allows for the tilt plus half a
       plate standing on the ribbon */
    A = Math.min(W * 0.36, H * 0.46 / (RATIO + TILE * ASPECT / 2));
  }

  function project(x, y, z) {
    var k = A * DIST / (DIST - z);
    return [CX + k * x, CY + k * y, k];
  }

  function drawPlate(i, psi) {
    var c = Math.cos(psi), s = Math.sin(psi);
    var C = [c * U[0] + s * V[0], c * U[1] + s * V[1], c * U[2] + s * V[2]];
    var T = [-s * U[0] + c * V[0], -s * U[1] + c * V[1], -s * U[2] + c * V[2]];
    var hw = TILE / 2;               /* half width, in ring radii */
    var hh = hw * ASPECT;

    var p0 = project(C[0], C[1], C[2]);
    var pT = project(C[0] + T[0] * hw, C[1] + T[1] * hw, C[2] + T[2] * hw);
    var pA = project(C[0] + AXV[0] * hh, C[1] + AXV[1] * hh, C[2] + AXV[2] * hh);

    var ex = pT[0] - p0[0], ey = pT[1] - p0[1];
    var fx = pA[0] - p0[0], fy = pA[1] - p0[1];
    if (Math.abs(ex * fy - ey * fx) < 0.5) return;   /* edge on */

    /* a plate whose face is turned away from the eye is a sliver, and a sliver
       that is also bright reads as a rendering fault — fade it out instead */
    var face = Math.abs(C[2]);
    var alpha = (face - 0.05) / 0.16;
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha * alpha;

    var facing = C[2] > 0;
    var img = (facing ? FRONT : BACK)[i];

    ctx.setTransform(ex * 2 / TS, ey * 2 / TS, fx * 2 / TS, fy * 2 / TS, p0[0], p0[1]);
    ctx.drawImage(img, -TS / 2, -TS / 2, TS, TS);
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!FRONT.length) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';

    var list = [], i;
    for (i = 0; i < N; i++) {
      var psi = PHASE * Math.PI / 180 - i * TAU / N + angle;
      var c = Math.cos(psi), s = Math.sin(psi);
      list.push({ i: i, psi: psi, z: c * U[2] + s * V[2] });
    }
    list.sort(function (a, b) { return a.z - b.z; });   /* far first */

    for (i = 0; i < list.length; i++) drawPlate(list[i].i, list[i].psi);
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

    if (Math.abs(rate) > 0.005) {
      angle = (angle + dt * rate * TAU / DUR) % TAU;
      render();
    }
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

  host.addEventListener('pointerenter', function () { hot = true; start(); });
  host.addEventListener('pointermove', function () { hot = true; }, { passive: true });
  host.addEventListener('pointerleave', function () { hot = false; });
  /* a touch device never sends pointerleave after a tap, so the ribbon would
     stay at hover speed for the rest of the session */
  host.addEventListener('pointerup', function () {
    if (hot) setTimeout(function () { hot = false; }, 900);
  }, { passive: true });
  host.addEventListener('pointercancel', function () { hot = false; });

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
    if (document.hidden) stop();
  });

  var q = 0;
  window.addEventListener('resize', function () {
    clearTimeout(q);
    q = setTimeout(function () { resize(); render(); }, 160);
  }, { passive: true });

  window.__gallery = { plates: function () { return FRONT.length; }, angle: function () { return angle; } };
})();
