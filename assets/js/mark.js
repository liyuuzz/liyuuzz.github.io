/* ==========================================================================
   mark.js — the hero mark, as an orb of dots.

   The eleven rays of the logo are turned into a point cloud: every ray is
   sampled at an even spacing and each station throws a little dust off its
   axis, so a ray reads as a beam of particles rather than a line. A shell of
   far dimmer dots orbits the whole figure, which is what makes it read as a
   sphere seen from outside instead of a drawing pinned to the wall.

   Everything is then rotated by hand (yaw, a slow in-plane spin, tilt),
   projected with a light perspective divide, and painted back to front so
   near dots occlude far ones. Yaw and tilt oscillate rather than cycle: the
   mark is a flat constellation, and a full turn would collapse it to a line
   twice a revolution.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('markCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TAU = Math.PI * 2;

  /* ---- geometry, in the SVG's own 64-unit space normalised to radius 1 ---- */
  var R_OUT = 26 / 32;
  var R_LONG = 8 / 32;
  var R_SHORT = 17 / 32;
  var R_DOT = 21 / 32;
  var LONG = [0, 60, 120, 180, 240, 300];
  var SHORT = [30, 150, 210, 270, 330];   /* 90 is missing on purpose */

  var STEP = 0.040;                       /* spacing along a ray */
  var ACCENT = [154, 107, 255];

  function dir(deg) {
    var r = deg * Math.PI / 180;
    return [Math.sin(r), -Math.cos(r)];
  }
  function hash(x, y) {
    var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---- the cloud ------------------------------------------------------- */
  /* every dot keeps its model-space position and its own bookkeeping; the
     screen fields are overwritten each frame, so nothing is allocated in the
     loop */
  var dots = [];
  var satHead = null;

  function push(x, y, z, f, ray, kind) {
    dots.push({
      x: x, y: y, z: z,
      ord: dots.length,                       /* arrival order, fixed before any sort */
      f: f,                                   /* 0 inner end → 1 tip */
      ray: ray,
      kind: kind,                             /* 0 core, 1 dust, 2 shell, 3 satellite */
      ph: hash(x * 91.7, y * 43.1) * TAU,
      amp: 0.5 + hash(y * 17.3, x * 29.9) * 0.5,
      sx: 0, sy: 0, sz: 0, sr: 0, sv: 0, sa: 0
    });
  }

  function rail(deg, r0, per, index) {
    var d = dir(deg);
    var len = R_OUT - r0;
    var n = Math.max(3, Math.round(len / STEP));
    var bowZ = 0.05 * Math.cos(deg * Math.PI / 90 + 1.1);

    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n;
      var r = r0 + len * f;

      /* the core of the beam: on axis, brightest, closest to the plane */
      push(d[0] * r, d[1] * r, bowZ * f, f, index, 0);

      /* the dust it sheds: an off-axis scatter that opens outward, plus depth
         noise so the beam has thickness once it turns. The offsets are hashed,
         not mirrored — mirrored offsets read as two parallel rails */
      for (var s = 1; s <= per; s++) {
        var spread = (0.010 + 0.048 * f) * (hash(i * 1.73, s * 3.11 + deg) - 0.5) * 2;
        push(
          d[0] * r - d[1] * spread,
          d[1] * r + d[0] * spread,
          bowZ * f + (hash(i * 3.7, s + deg) - 0.5) * 0.24,
          f, index, 1
        );
      }
    }
  }

  (function build() {
    var k = 0;
    for (var a = 0; a < LONG.length; a++) rail(LONG[a], R_LONG, 2, k++);
    for (var b = 0; b < SHORT.length; b++) rail(SHORT[b], R_SHORT, 1, k++);

    /* the shell: a fibonacci sphere just outside the rays. Its only job is to
       give the eye a horizon, so the mark reads as an object in space */
    var N = 168;
    var GA = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N;
      var rr = Math.sqrt(Math.max(0, 1 - y * y));
      var th = i * GA;
      var rad = 0.97 + hash(i, 5.1) * 0.22;
      push(Math.cos(th) * rr * rad, y * rad, Math.sin(th) * rr * rad, 0.5, -1, 2);
    }

    /* the piece that left the mark: its own little cluster, orbiting.
       Its head keeps a reference, because sorting reorders the array. */
    /* the head is pushed first and kept by reference, because sorting reorders
       the array and an index would be wrong by the next frame */
    push(0, 0, 0, 1, -2, 3);
    satHead = dots[dots.length - 1];
    for (var s = 0; s < 3; s++) {
      var ang = s / 3 * TAU + 0.4;
      push(Math.cos(ang) * 0.016, Math.sin(ang) * 0.016, (hash(s, 7.7) - 0.5) * 0.03, 1, -2, 3);
    }
  })();

  var CORE = 0, DUST = 1, SHELL = 2, SAT = 3;

  /* ---- colour ---------------------------------------------------------- */
  /* v is brightness, a is alpha; both are quantised so the whole frame keeps
     reusing a few hundred strings instead of making one per dot per frame */
  var Q = 40;
  var inkCache = {};
  function ink(v, a) {
    var vi = (v * Q) | 0; if (vi < 0) vi = 0; else if (vi > Q) vi = Q;
    var ai = (a * Q) | 0; if (ai < 1) ai = 1; else if (ai > Q) ai = Q;
    var key = vi * 64 + ai;
    var hit = inkCache[key];
    if (hit) return hit;

    var val = vi / Q;
    var g = val * 255;
    var lift = Math.min(1, val * 1.14);
    var sat = 0.62 - val * 0.30;            /* near dots go violet, near-white at the crest */
    var r = g * (1 - sat) + ACCENT[0] * lift * sat;
    var gg = g * (1 - sat) + ACCENT[1] * lift * sat;
    var b = g * (1 - sat) + ACCENT[2] * lift * sat;
    if (val > 0.80) {
      var w = (val - 0.80) / 0.20 * 0.5;
      r += (255 - r) * w; gg += (255 - gg) * w; b += (255 - b) * w;
    }
    return (inkCache[key] = 'rgba(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ',' + (ai / Q).toFixed(3) + ')');
  }

  /* ---- viewport -------------------------------------------------------- */
  var W = 1, H = 1, DPR = 1, R = 1, cx = 0, cy = 0, RS = 1;
  var aimX = 0, aimY = 0, smX = 0, smY = 0;
  var startedAt = 0, running = false, visible = true;

  function resize() {
    var b = canvas.getBoundingClientRect();
    if (!b.width || !b.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = b.width; H = b.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    R = Math.min(W, H) * 0.42;
    cx = W / 2; cy = H / 2;
    RS = Math.max(1.25, Math.min(W, H) / 400);   /* dot radius scale */
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---- frame ----------------------------------------------------------- */
  function draw(now) {
    var t = REDUCED ? 0.75 : Math.max(0, (now - startedAt) / 1000);
    var intro = REDUCED ? 1 : Math.min(1, t / 1.5);

    /* the turn: two out-of-phase oscillators, plus whatever the pointer adds */
    var yaw = Math.sin(t * 0.42) * 0.36 + smX * 0.32;
    var tilt = 0.30 + Math.sin(t * 0.31 + 0.6) * 0.17 + smY * 0.18;
    var spin = t * 0.085;
    var breath = 1 + 0.018 * Math.sin(t * 1.15);

    var cs = Math.cos(spin), ss = Math.sin(spin);
    var cw = Math.cos(yaw), sw = Math.sin(yaw);
    var ct = Math.cos(tilt), st = Math.sin(tilt);

    ctx.clearRect(0, 0, W, H);

    /* a violet wash under everything, so dots sit in light */
    var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.10);
    halo.addColorStop(0, 'rgba(154,107,255,0.10)');
    halo.addColorStop(0.42, 'rgba(120,72,214,0.036)');
    halo.addColorStop(1, 'rgba(90,50,180,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.10, 0, TAU);
    ctx.fill();

    /* The satellite is welded into the notch the missing short ray left behind.
       It rides the same spin as the rays — no orbit of its own. An independent
       swing (±23° here) reads as a second object floating nearby, because the
       mark is turning underneath it at a different rate. All it is allowed is a
       breath in and out, plus about two degrees of jitter, which is small enough
       to stay locked while still not looking like a printed dot. */
    var satA = 0.032 * Math.sin(t * 0.86);
    var satR = R_DOT + 0.030 + Math.sin(t * 0.73) * 0.011;
    var satX = Math.cos(satA) * satR;
    var satY = Math.sin(satA) * satR;

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];

      /* model → spun → yawed → tilted */
      var mx = d.x, my = d.y, mz = d.z;
      /* +0.02 puts it in the figure's own plane, not floating in front of it */
      if (d.kind === SAT) { mx += satX; my += satY; mz += 0.02; }

      var px = mx * cs - my * ss;
      var py = mx * ss + my * cs;

      var x1 = px * cw + mz * sw;
      var z1 = -px * sw + mz * cw;
      var y1 = py * ct - z1 * st;
      var z2 = py * st + z1 * ct;

      var pers = 1 / (1 - z2 * 0.34);

      /* stagger in: each dot arrives from a wider orbit */
      var stag = REDUCED ? 1 : clamp01(intro * 1.7 - (d.ord / dots.length) * 0.7);
      var e = easeOut(stag);
      var spread = 1 + (1 - e) * 0.9;

      d.sx = cx + x1 * R * pers * spread * breath;
      d.sy = cy + y1 * R * pers * spread * breath;
      d.sz = z2;

      var dep = (z2 + 1) * 0.5;               /* 0 far → 1 near */

      if (d.kind === SHELL) {
        d.sr = (0.30 + 0.50 * dep) * RS;
        d.sv = (0.08 + 0.26 * dep) * (0.7 + 0.3 * Math.sin(t * 0.9 + d.ph));
        d.sa = (0.09 + 0.24 * dep) * e;

      } else if (d.kind === SAT) {
        var near = d === satHead;
        d.sr = (near ? 2.9 : 0.85) * RS * (0.8 + 0.5 * dep);
        d.sv = (near ? 1 : 0.66) + 0.2 * dep;
        d.sa = e;

      } else {
        /* a squall travelling outward along each ray: this is the same trick
           the wordmark uses, and it keeps a still figure from looking dead */
        var pulse = 0.5 + 0.5 * Math.sin(t * 1.55 - d.ray * 1.03 - d.f * 2.4);
        var core = d.kind === CORE;
        var jit = 0.72 + 0.56 * d.amp;          /* per-dot size variance */

        d.sr = ((core ? 0.62 : 0.34) + (core ? 0.86 : 0.56) * dep + (core ? 0.44 : 0.24) * d.f) * RS * jit;
        d.sv = (core ? 0.24 : 0.13)
             + 0.30 * dep
             + 0.22 * d.f
             + 0.20 * pulse * d.amp
             + (core ? 0.08 : 0);
        d.sa = (core ? 0.42 : 0.22) + 0.42 * dep;
        d.sa *= e;
      }
    }

    /* back to front */
    dots.sort(byZ);

    for (var j = 0; j < dots.length; j++) {
      var p = dots[j];
      if (p.sa < 0.012) continue;
      ctx.fillStyle = ink(clamp01(p.sv), clamp01(p.sa));
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(0.35, p.sr), 0, TAU);
      ctx.fill();
    }

    /* the satellite gets one soft bloom on top of its dots — a single radial
       gradient is far cheaper than shadowBlur on every particle */
    if (satHead) {
      var de = REDUCED ? 1 : easeOut(clamp01(intro * 1.5));
      var gr = ctx.createRadialGradient(satHead.sx, satHead.sy, 0, satHead.sx, satHead.sy, 15 * RS);
      gr.addColorStop(0, 'rgba(201,168,255,' + (0.34 * de).toFixed(3) + ')');
      gr.addColorStop(0.42, 'rgba(154,107,255,' + (0.11 * de).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(154,107,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(satHead.sx, satHead.sy, 15 * RS, 0, TAU);
      ctx.fill();
    }
  }

  function byZ(a, b) { return a.sz - b.sz; }

  /* ---- loop ------------------------------------------------------------ */
  function loop(now) {
    if (!running) return;
    draw(now);
    requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    resize();
    if (REDUCED) { draw(performance.now()); return; }
    running = true;
    startedAt = performance.now();
    requestAnimationFrame(loop);
  }

  function stop() { running = false; }

  window.addEventListener('resize', function () {
    resize();
    if (REDUCED) draw(performance.now());
  });

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    aimX = (e.clientX / window.innerWidth) * 2 - 1;
    aimY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('pointerleave', function () { aimX = aimY = 0; });

  var sm = window.setInterval(function () {
    smX += (aimX - smX) * 0.06;
    smY += (aimY - smY) * 0.06;
  }, 16);
  window.addEventListener('pagehide', function () { window.clearInterval(sm); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !REDUCED) start();
      else if (!visible) stop();
    }, { threshold: 0.01 }).observe(canvas);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (visible && !REDUCED) start();
  });

  start();
})();
