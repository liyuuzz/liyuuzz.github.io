/* ==========================================================================
   morph.js — the closing plate: the mark, written in type, that becomes a word.

   Two point clouds are built once. One is the mark: every ray sampled across a
   wedge that opens outward, so the star has the same area a word does. The
   other is the word itself, rasterised and then sampled on a jittered grid at
   one glyph advance. They are paired by angle — not by index — so a click reads
   as the whole figure turning into the other, rather than dots shuffling.

   Because both sets come out of the same advance, the mark and the word end up
   with almost the same number of glyphs; whatever surplus is left is thinned
   proportionally.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('morph');
  if (!host) return;
  var cv = document.getElementById('morphCanvas');
  var wordEl = host.querySelector('.morph-word');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  /* the mark, in the SVG's own 64-unit space normalised to an outer radius of 1 */
  var R_OUT = 1;
  var R_LONG = 8 / 32;
  var R_SHORT = 17 / 32;
  var R_DOT = 21 / 32;
  var LONG = [0, 60, 120, 180, 240, 300];
  var SHORT = [30, 150, 210, 270, 330];   /* 90 is missing on purpose */

  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function dir(deg) {
    var r = deg * Math.PI / 180;
    return [Math.sin(r), -Math.cos(r)];
  }
  function hash(x, y) {
    var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* the wedge that every ray is filled with: hairline at the inner end, opening
     outward exactly the way the painted beam does */
  function halfWidth(f) { return 0.030 + 0.045 * f; }

  var W = 0, H = 0, U = 0, DPR = 1;
  var pairs = [];
  var m = 0, target = 0, running = false, raf = 0, prev = 0, hover = null;
  var FONT = 10, STACK = 'sans-serif';

  /* ------------------------------------------------------------------ sets */
  function markSet(nTarget, span) {
    /* area of the whole figure in unit space, so the glyph advance can be
       chosen to land on the same count as the word */
    var area = 0, k;
    for (k = 0; k < LONG.length; k++) area += (R_OUT - R_LONG) * 2 * (0.030 + 0.0225);
    for (k = 0; k < SHORT.length; k++) area += (R_OUT - R_SHORT) * 2 * (0.030 + 0.0225);

    var Rpx = span / 2;
    var step = Math.sqrt(area * Rpx * Rpx / Math.max(1, nTarget)) / Rpx;
    if (!(step > 0.0001)) step = 0.02;

    var out = [];
    function rail(deg, r0) {
      var d = dir(deg);
      var len = R_OUT - r0;
      var nT = Math.max(2, Math.round(len / step));
      for (var i = 0; i <= nT; i++) {
        var f = i / nT;
        var r = r0 + len * f;
        var hw = halfWidth(f);
        var nS = Math.max(1, Math.round(hw * 2 / step));
        for (var s = 0; s <= nS; s++) {
          var off = (-1 + 2 * s / nS) * hw;
          out.push({
            x: Rpx * (d[0] * r - d[1] * off) + (hash(i * 3.1, s + deg) - 0.5) * step * Rpx * 0.8,
            y: Rpx * (d[1] * r + d[0] * off) + (hash(deg * 2.3, i * 1.9 + s) - 0.5) * step * Rpx * 0.8
          });
        }
      }
    }
    for (k = 0; k < LONG.length; k++) rail(LONG[k], R_LONG);
    for (k = 0; k < SHORT.length; k++) rail(SHORT[k], R_SHORT);

    /* the piece that left, in the notch — three glyphs and a head */
    var satR = R_DOT * Rpx;
    out.push({ x: satR, y: 0 });
    for (var s2 = 0; s2 < 3; s2++) {
      var a = s2 / 3 * TAU + 0.5;
      out.push({ x: satR + Math.cos(a) * step * Rpx * 0.9, y: Math.sin(a) * step * Rpx * 0.9 });
    }
    return out;
  }

  function wordSet(text, adv, span) {
    var S = 360;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var x = c.getContext('2d');
    var stack = getComputedStyle(document.body).fontFamily || 'sans-serif';

    var F = S * 0.5;
    x.font = '700 ' + F + 'px ' + stack;
    var w0 = x.measureText(text).width || F;
    F = F * (S * 0.88) / w0;
    x.font = '700 ' + F + 'px ' + stack;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(text, S / 2, S / 2);

    var px = x.getImageData(0, 0, S, S).data;
    var cell = Math.max(1.5, adv * S / span);      /* one glyph advance, in raster px */
    var out = [];
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;

    for (var gy = 0; gy < S; gy += cell) {
      for (var gx = 0; gx < S; gx += cell) {
        var jx = gx + hash(gx, gy) * cell;
        var jy = gy + hash(gy + 7.7, gx + 3.3) * cell;
        var ix = jx | 0, iy = jy | 0;
        if (ix < 0 || ix >= S || iy < 0 || iy >= S) continue;
        if (px[(iy * S + ix) * 4 + 3] < 128) continue;
        out.push({ x: jx, y: jy });
        if (jx < x0) x0 = jx; if (jx > x1) x1 = jx;
        if (jy < y0) y0 = jy; if (jy > y1) y1 = jy;
      }
    }
    if (!out.length) return out;

    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    var s3 = span / Math.max(1, Math.max(x1 - x0, y1 - y0));
    for (var i = 0; i < out.length; i++) {
      out[i].x = (out[i].x - mx) * s3;
      out[i].y = (out[i].y - my) * s3;
    }
    return out;
  }

  /* pair the two clouds by angle, so the change reads as one figure turning
     into the other and not as a reshuffle */
  function order(set) {
    return set.slice().sort(function (a, b) {
      return Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
    });
  }

  function build() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; U = Math.min(W, H);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);

    var span = U * 0.78;
    FONT = U * 0.0176;
    STACK = getComputedStyle(document.body).fontFamily || 'sans-serif';
    var adv = FONT * 0.64;

    var word = ((wordEl && wordEl.textContent) || 'Hi').trim() || 'Hi';
    var B = order(wordSet(word, adv, span));
    var A = order(markSet(B.length || 400, span));

    var M = Math.min(A.length, B.length);
    pairs.length = 0;
    for (var j = 0; j < M; j++) {
      var a = A[(j * A.length / M) | 0];
      var b = B[(j * B.length / M) | 0];
      pairs.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        ch: CHARS.charAt((hash(j * 2.7, j * 1.3) * CHARS.length) | 0),
        ph: hash(j, 5.5) * TAU,
        sp: 0.5 + hash(j, 9.1) * 0.85,
        wob: 0.4 + hash(j, 3.3) * 0.8
      });
    }

    if (!running) render(0, 16);
  }

  /* ----------------------------------------------------------------- paint */
  function render(now, dt) {
    var t = now / 1000;
    m += (target - m) * (REDUCED ? 1 : Math.min(1, dt / 460));
    if (Math.abs(target - m) < 0.0008) m = target;

    var e = easeIO(m);
    var travel = 4 * e * (1 - e);       /* biggest scatter is mid-flight */
    var cx = W / 2, cy = H / 2;
    var fs = FONT * (1 + 0.12 * travel);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + fs.toFixed(2) + 'px ' + STACK;

    /* violet at rest, near-white once the word has landed */
    var base = 0.66 + 0.26 * e;
    var ink = 'rgba(226,212,255,' + base.toFixed(3) + ')';
    var hot = 'rgba(246,242,255,0.97)';
    var hx = hover ? hover.x : -1e9, hy = hover ? hover.y : -1e9;
    var hr = U * 0.16, hr2 = hr * hr;

    var cur = '';
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var px = cx + p.ax + (p.bx - p.ax) * e;
      var py = cy + p.ay + (p.by - p.ay) * e;

      if (!REDUCED) {
        px += Math.sin(t * p.sp + p.ph) * U * 0.0032 * p.wob;
        py += Math.cos(t * p.sp * 0.9 + p.ph) * U * 0.0032 * p.wob;
        py -= travel * Math.sin(p.ph) * U * 0.045;
      }

      var lit = false;
      if (hover) {
        var dx = px - hx, dy = py - hy, d2 = dx * dx + dy * dy;
        if (d2 < hr2) {
          var d = Math.sqrt(d2) || 1, push = 1 - d / hr;
          px += dx / d * push * push * U * 0.05;
          py += dy / d * push * push * U * 0.05;
          lit = push > 0.5;
        }
      }

      var want = lit ? hot : ink;
      if (want !== cur) { cur = want; ctx.fillStyle = want; }
      ctx.fillText(p.ch, px, py);
    }
  }

  var acc = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(64, now - prev);
    prev = now;

    /* a thousand tiny glyphs every frame is fine for a second-long morph and
       wasteful forever after — once it has settled, drop to about 20fps, which
       is still enough for the breath to read as breathing */
    acc += dt;
    var settled = Math.abs(m - target) < 0.0009 && !hover;
    if (settled && acc < 46) {
      raf = requestAnimationFrame(frame);
      return;
    }
    acc = 0;

    render(now, dt);
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

  /* ---------------------------------------------------------------- input */
  function toggle() {
    target = target ? 0 : 1;
    host.setAttribute('data-seen', '1');
    host.setAttribute('aria-pressed', target ? 'true' : 'false');
    if (REDUCED) { m = target; render(performance.now(), 16); }
    else start();
  }

  host.addEventListener('click', toggle);
  host.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle();
    }
  });
  host.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    hover = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!REDUCED) start();
  }, { passive: true });
  host.addEventListener('pointerleave', function () { hover = null; });

  /* ---------------------------------------------------------------- wiring */
  build();
  if (REDUCED) render(performance.now(), 16);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0 }).observe(host);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
  });

  var q = 0;
  window.addEventListener('resize', function () {
    clearTimeout(q);
    q = setTimeout(function () {
      stop();
      build();
      start();
    }, 180);
  }, { passive: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      stop();
      build();
      start();
    });
  }

  /* the word arrives from content.json long after this script ran, so the
     canvas would keep drawing whatever was in the HTML unless it is watched */
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      stop();
      build();
      start();
    }).observe(wordEl, { childList: true, characterData: true, subtree: true });
  }

  window.__morph = { count: function () { return pairs.length; }, state: function () { return m; } };
})();
