/* ==========================================================================
   arc.js — the background of the works page.

   A parabolic band of dots, sampled on a fixed grid, each dot sized by how
   close it sits to the curve. It is the same dot logic the rest of the site
   uses, only here the dots are the picture instead of the paint.

   The reference computed four powers per dot per frame and wrote a fresh
   fillStyle for each one. That is 8,000 style changes a frame for the same
   sixteen colours, so this version quantises the intensity into buckets,
   builds the palette once, and lets the rects batch. Same picture, a fraction
   of the work.

   Colours are the site's, not the reference's: deep violet at the edge of the
   glow, through the accent, to rice white in the core.
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('arcCanvas');
  if (!cv) return;
  var ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* ---- tuning ---------------------------------------------------------- */
  /* Each page that wears this background says what kind of room it is with
     data-* attributes on the canvas, so there is one renderer and not two.
     The works page wants the arch to be the picture; the notes page wants it
     to be the light in the room. */
  function num(name, dflt) {
    var raw = cv.getAttribute('data-' + name);
    if (raw === null || raw === '') return dflt;
    var v = parseFloat(raw);
    return isFinite(v) ? v : dflt;
  }

  var SPACING = 5;          /* grid pitch, css px                          */
  var DOT = 4.4;            /* largest a dot can get — a hair under the
                               grid pitch, so the mesh stays readable as dots */
  var PEAK = 0.32;          /* where the crown sits, as a fraction of h    */
  var DROP = 0.36;          /* how far the arms fall, as a fraction of h   */
  var WIDTH = 1.0;          /* arc width, as a fraction of the viewport    */
  var THICK = 1;            /* band thickness multiplier                   */
  var SPEED = 1;
  var GAIN = 0.92;          /* overall brightness                          */
  var LEVELS = 28;          /* intensity buckets                           */
  var CORE = 1.7;           /* >1 pulls the light onto the curve itself    */

  SPACING = num('spacing', SPACING);
  DOT = num('dot', DOT);
  PEAK = num('peak', PEAK);
  DROP = num('drop', DROP);
  WIDTH = num('width', WIDTH);
  THICK = num('thick', THICK);
  SPEED = num('speed', SPEED);
  GAIN = num('gain', GAIN);
  CORE = num('core', CORE);

  /* Two effects live here, not one. The works page is an arch of soft round
     dots — a picture you read. The notes page is a grid of hard square cells
     — the same arch, but sampled by a chip instead of drawn by a brush. Same
     geometry, opposite texture, so the two pages are never mistaken for each
     other even on a phone where the shape itself barely differs. */
  var MODE = (cv.getAttribute('data-mode') || 'dot').toLowerCase();
  var PX = num('pixel', 10);   /* pixel-arc cell pitch, css px */

  /* ---- palette --------------------------------------------------------- */
  /* Three stops instead of the reference's stack of powers: the arm of the arc
     in deep violet, the body in the site's accent, the core in rice rather than
     white — a pure white core blooms into every screen's own idea of "glow" and
     stops belonging to this page. */
  var DEEP = [32, 18, 58];
  var BODY = [120, 80, 212];
  var CORE_C = [214, 198, 255];   /* lilac, not white: the highlight should read
                                     as the accent getting brighter, not as a
                                     hole burned through the page */

  var LUT = (function () {
    var out = [], mid = 0.55;
    for (var k = 0; k < LEVELS; k++) {
      var i = (k + 0.5) / LEVELS;
      var a, b, t;
      if (i < mid) { a = DEEP; b = BODY; t = i / mid; }
      else { a = BODY; b = CORE_C; t = (i - mid) / (1 - mid); }
      /* a touch of ease so the accent occupies more of the band than the ends */
      t = t * t * (3 - 2 * t);
      out.push('rgb(' +
        Math.round((a[0] + (b[0] - a[0]) * t) * GAIN) + ',' +
        Math.round((a[1] + (b[1] - a[1]) * t) * GAIN) + ',' +
        Math.round((a[2] + (b[2] - a[2]) * t) * GAIN) + ')');
    }
    return out;
  })();

  /* the pixel arc's palette: a cold teal-emerald instead of the works page's
     violet, so the two backgrounds differ in hue as well as in texture.
     Deep sea at the arms, jade through the body, a pale mint at the core. */
  var P_DEEP = [8, 26, 32];
  var P_BODY = [42, 158, 150];
  var P_CORE = [198, 255, 240];
  var P_LUT = (function () {
    var out = [], mid = 0.5;
    for (var k = 0; k < LEVELS; k++) {
      var i = (k + 0.5) / LEVELS;
      var a, b, t;
      if (i < mid) { a = P_DEEP; b = P_BODY; t = i / mid; }
      else { a = P_BODY; b = P_CORE; t = (i - mid) / (1 - mid); }
      t = t * t * (3 - 2 * t);
      out.push('rgb(' +
        Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
        Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
        Math.round(a[2] + (b[2] - a[2]) * t) + ')');
    }
    return out;
  })();

  /* ---- viewport -------------------------------------------------------- */
  var W = 1, H = 1, DPR = 1;

  /* one reusable bucket per level: [x, y, size] triples, and a live count */
  var bx = [], by = [], bs = [], bn = [];
  for (var q = 0; q < LEVELS; q++) { bx.push([]); by.push([]); bs.push([]); bn.push(0); }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(w));
    H = Math.max(2, Math.round(h));
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw(true);
  }

  /* ---- one frame ------------------------------------------------------- */
  var time = 0;

  /* the pixel room: hard square cells on a coarse grid, each cell bright by
     how close its centre sits to the same parabola the works page uses. No
     anti-aliasing, no soft size ramp — a cell is lit or dark, which is what
     makes it read as a chip rendering the arc rather than a spray of dots. */
  function pixelFrame() {
    var t = time;
    var narrow = W < 760;
    var cell = narrow ? Math.max(6, PX * 0.78) : PX;
    var gap = cell * 0.62;                 /* drawn square inside its grid slot —
                                              small enough that the mesh reads as
                                              floating pixels, not a solid dome */
    var inset = (cell - gap) * 0.5;
    var cx = W / 2;
    var half = (W * WIDTH) / 2;
    var peakY = H * (narrow ? Math.max(PEAK, 0.34) : PEAK);
    var drop = H * DROP * (narrow ? 0.60 : 1);
    var thick = H * 0.115 * THICK;         /* half-thickness of the lit band   */
    var cols = Math.ceil(W / cell);
    var rows = Math.ceil(H / cell);

    for (var k = 0; k < LEVELS; k++) bn[k] = 0;

    for (var gy = 0; gy < rows; gy++) {
      var y = gy * cell + cell * 0.5;
      for (var gx = 0; gx < cols; gx++) {
        var x = gx * cell + cell * 0.5;
        var nx = (x - cx) / half;
        var anx = nx < 0 ? -nx : nx;
        if (anx > 1) continue;
        var curve = peakY + nx * nx * drop;
        var d = y - curve; if (d < 0) d = -d;
        if (d >= thick) continue;
        var cap = 1 - Math.pow(anx, 2.5);
        if (cap <= 0.02) continue;
        var inten = Math.pow(1 - d / thick, CORE) * cap * GAIN;
        /* a slow wave, but coarser than the dot version's — the flicker moves
           cell to cell, so it reads as data changing, not light shimmering */
        var wave = Math.sin(gx * 0.34 + t * 0.7) * 0.5 + Math.cos(gy * 0.42 - t * 0.9) * 0.5;
        inten *= 0.80 + 0.20 * wave;
        if (inten <= 0.04) continue;

        var level = (inten * LEVELS) | 0;
        if (level >= LEVELS) level = LEVELS - 1;
        var n = bn[level];
        bx[level][n] = gx * cell + inset;
        by[level][n] = gy * cell + inset;
        bn[level] = n + 1;
      }
    }

    for (var L = 0; L < LEVELS; L++) {
      var count = bn[L];
      if (!count) continue;
      ctx.fillStyle = P_LUT[L];
      var xs = bx[L], ys = by[L];
      for (var n2 = 0; n2 < count; n2++) {
        ctx.fillRect(xs[n2], ys[n2], gap, gap);
      }
    }
  }

  function draw(force) {
    if (!running && !force) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    if (MODE === 'pixel') {
      pixelFrame();
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    for (var k = 0; k < LEVELS; k++) bn[k] = 0;

    /* a phone gets a smaller arch: same idea, less of the screen, and the
       dots stay fine because the pitch shrinks with the viewport */
    var narrow = W < 760;
    var step = narrow ? 4 : SPACING;
    var cx = W / 2;
    var half = (W * WIDTH) / 2;
    /* narrow screens scale the page's own tuning rather than replacing it, or
       two pages tuned differently would collapse into the same picture on a
       phone */
    var peakY = H * (narrow ? Math.max(PEAK, 0.36) : PEAK);
    var drop = H * DROP * (narrow ? 0.62 : 1);
    var bandK = narrow ? 0.045 : 0.072;
    var bandK2 = narrow ? 0.028 : 0.042;
    var t = time;

    /* precompute the two per-column terms: the curve height and how wide the
       band is there. Both are functions of x only, so the inner loop can skip
       everything that repeats 180 times a frame. */
    var cols = [];
    for (var x = 0; x < W; x += step) {
      var nx = (x - cx) / half;
      var anx = Math.abs(nx);
      var curve = peakY + nx * nx * drop;
      /* the arms are thicker and dimmer; the crown is thin and bright. Both
         scale with the viewport, or a short window gets a band it cannot
         contain. */
      var band = H * (bandK + (1 - anx) * bandK2) * THICK;
      var cap = Math.max(0, 1 - Math.pow(anx, 2.5));
      if (cap <= 0.01) continue;
      cols.push(x, curve, band, cap, nx);
    }

    for (var c = 0; c < cols.length; c += 5) {
      var px = cols[c], curveY = cols[c + 1], thick = cols[c + 2], fade = cols[c + 3];

      for (var y = 0; y < H; y += step) {
        var d = y - curveY;
        if (d < 0) d = -d;
        if (d >= thick) continue;

        /* the power keeps the light on the curve instead of spreading it
           evenly across the band — an arc, not a smear */
        var inten = Math.pow(1 - d / thick, CORE);

        /* one slow shimmer travelling along the arc. Crossed waves at the
           reference's frequencies chopped the band into lobes; this keeps the
           shape and only breathes inside it. */
        var wave = Math.sin(px * 0.012 + t) * 0.5 + Math.cos(y * 0.017 - t * 1.3) * 0.5;
        inten *= 0.82 + 0.18 * wave;
        inten *= fade;
        if (inten <= 0.02) continue;

        var level = (inten * LEVELS) | 0;
        if (level >= LEVELS) level = LEVELS - 1;
        var n = bn[level];
        bx[level][n] = px;
        by[level][n] = y;
        bs[level][n] = DOT * inten;
        bn[level] = n + 1;
      }
    }

    /* one colour per bucket instead of one per dot */
    for (var L = 0; L < LEVELS; L++) {
      var count = bn[L];
      if (!count) continue;
      ctx.fillStyle = LUT[L];
      var xs = bx[L], ys = by[L], ss = bs[L];
      for (var n2 = 0; n2 < count; n2++) {
        ctx.fillRect(xs[n2], ys[n2], ss[n2], ss[n2]);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- clock ----------------------------------------------------------- */
  var running = false, visible = true, raf = 0, prev = 0;

  function frame(now) {
    if (!running) return;
    var dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0.016;
    prev = now;
    /* seconds, not frames: the drift stays the same speed on a 120Hz screen */
    time += dt * 1.1 * SPEED;
    draw(false);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || REDUCE || !visible || document.hidden) return;
    running = true;
    prev = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---- wiring ---------------------------------------------------------- */
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 150);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0 }).observe(cv);
  }

  resize();
  if (REDUCE) {
    /* one still frame, drawn at a moment where the band is at full width */
    time = 2.2;
    draw(true);
  } else {
    start();
  }

  window.__arc = { levels: LEVELS, draw: function () { draw(true); } };
})();
