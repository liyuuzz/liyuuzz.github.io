/* ==========================================================================
   wordmark.js — the hero wordmark is not type.

   The word is drawn once into an offscreen plate, read back as a luminance
   mask, and then thrown away. What survives is a grid of dots that only knows
   how bright the letterform was underneath it. A travelling squall — two
   sine bands drifting in different directions — decides, per dot per frame,
   how much of that letterform is allowed to show. So the word is always there
   and never quite solid: dots are pulled out of it and carried across it.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.querySelector('.ghost-word');
  if (!host) return;
  var cv = host.querySelector('canvas');
  var src = host.querySelector('.ghost-text');
  if (!cv || !src) return;

  var ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* violet, not white — the field has to belong to the abyss it sits in */
  var STOPS = [
    [128, 82, 250],   // deep: the resting state of the field
    [176, 140, 255],  // lilac: the body of a squall
    [237, 233, 248]   // pale: the crest
  ];
  var STEPS = 7;      // how many interpolated steps get their own colour string

  var PAL = [];
  for (var si = 0; si < STEPS; si++) {
    var f = si / (STEPS - 1), s = f * (STOPS.length - 1);
    var j = Math.min(Math.floor(s), STOPS.length - 2), k = s - j;
    PAL.push([
      Math.round(STOPS[j][0] + (STOPS[j + 1][0] - STOPS[j][0]) * k),
      Math.round(STOPS[j][1] + (STOPS[j + 1][1] - STOPS[j][1]) * k),
      Math.round(STOPS[j][2] + (STOPS[j + 1][2] - STOPS[j][2]) * k)
    ]);
  }

  /* alpha is quantised before it reaches the cache, so the whole frame reuses
     a few hundred strings instead of allocating one per dot per frame */
  var AQ = 56;
  var cache = {};
  function ink(ci, qa) {
    var key = ci * 100 + qa;
    var hit = cache[key];
    if (hit) return hit;
    var c = PAL[ci];
    return (cache[key] = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (qa / AQ).toFixed(3) + ')');
  }

  var GAP_MIN = 3.2;     // css px between samples, before the width-based term
  var BIG_CHANCE = 0.07;

  var dots = [];
  var W = 0, H = 0, dpr = 1;
  var raf = 0, t0 = 0, running = false, alive = false;

  /* ------------------------------------------------------------------ build */
  function build() {
    W = host.clientWidth;
    H = host.clientHeight;
    if (!W || !H) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';

    var word = (src.textContent || '').trim() || 'Profunfis';

    /* the plate lives at 1:1 and never gets seen — it only exists to be read */
    var plate = document.createElement('canvas');
    plate.width = Math.ceil(W);
    plate.height = Math.ceil(H);
    var mc = plate.getContext('2d');
    var stack = getComputedStyle(document.body).fontFamily || 'sans-serif';

    var PROBE = 100;
    mc.font = '400 ' + PROBE + 'px ' + stack;
    if ('letterSpacing' in mc) mc.letterSpacing = '0px';

    var w100 = mc.measureText(word).width || PROBE;
    var capH = (mc.measureText('H').actualBoundingBoxAscent || PROBE * 0.72) / PROBE;

    /* two ceilings: the height of the band, and how wide the word may run
       before it has to be re-set smaller */
    var byHeight = (H * 0.96) / capH;
    var byWidth = PROBE * (W * 0.985) / w100;
    var size = Math.min(byHeight, byWidth);

    /* if height is what binds, the word is narrower than the band — stretch it
       back out a little rather than leave two empty shoulders */
    if (byHeight < byWidth) size = Math.min(byHeight, byWidth * 1.2);

    mc.font = '400 ' + size + 'px ' + stack;
    if ('letterSpacing' in mc) mc.letterSpacing = (size * 0.005).toFixed(2) + 'px';

    var m = mc.measureText(word);
    var asc = m.actualBoundingBoxAscent || size * capH;
    var desc = m.actualBoundingBoxDescent || 0;
    var tw = m.width;

    var sx = Math.min(1.2, Math.max(1, (W * 0.985) / tw));

    mc.save();
    mc.scale(sx, 1);
    mc.textAlign = 'left';
    mc.textBaseline = 'alphabetic';
    mc.fillStyle = '#fff';
    mc.fillText(word, (W - tw * sx) / (2 * sx), H / 2 + (asc - desc) / 2);
    mc.restore();

    var px = mc.getImageData(0, 0, plate.width, plate.height).data;

    /* ---- sample the mask into dots ---------------------------------- */
    var gap = Math.max(GAP_MIN, Math.round(W / 300));
    dots.length = 0;

    for (var y = 0; y < H; y += gap) {
      var row = Math.floor(y) * plate.width;
      for (var x = 0; x < W; x += gap) {
        var a = px[(row + Math.floor(x)) * 4 + 3];
        if (a < 48) continue;

        var lum = Math.pow(a / 255, 0.8);        // GAMMA: bites the soft edges
        if (Math.random() > 0.30 + lum * 0.70) continue;

        var big = Math.random() < BIG_CHANCE;
        dots.push({
          x: x + (Math.random() - 0.5) * gap * 0.6,
          y: y + (Math.random() - 0.5) * gap * 0.6,
          lum: lum,
          s: big ? 3.0 + Math.random() * 1.5 : 1.1 + Math.random() * 1.5,
          sq: Math.random() < 0.24,
          ph: Math.random() * 6.2832,
          sp: 0.34 + Math.random() * 0.86,
          am: (big ? 2.4 : 1.2) + Math.random() * 2.4,
          tint: Math.random(),
          /* one dot in six is not anchored: it falls the height of the band,
             wraps, and falls again. That is the snow in the storm. */
          fall: Math.random() < 0.16 ? 5 + Math.random() * 26 : 0
        });
      }
    }

    if (!running) render(0);
  }

  /* ----------------------------------------------------------------- paint */
  function render(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';   // overlap reads as glow

    for (var i = 0, n = dots.length; i < n; i++) {
      var d = dots[i];

      /* two bands, opposite drift: where they agree the field lights up */
      var u = d.x * 0.0075, v = d.y * 0.012;
      var b1 = Math.sin(u * 3.1 + v * 1.7 + d.ph + t * 0.55 * d.sp);
      var b2 = Math.sin(u * -1.9 + v * 2.6 - t * 0.34);
      var sq = 0.5 + 0.29 * b1 + 0.21 * b2;
      sq = sq < 0 ? 0 : sq > 1 ? 1 : sq;
      sq *= sq;                                  // calm stays calm, crests punch

      var a = 0.10 + 0.24 * d.lum
            + sq * (0.34 + 0.36 * d.lum) * (0.72 + 0.28 * d.tint);
      if (d.fall) a *= 0.66;

      var qa = (a * AQ) | 0;
      if (qa < 1) qa = 1; else if (qa > AQ) qa = AQ;

      var ci = (sq * (0.5 + 0.5 * d.tint) * (STEPS - 1)) | 0;

      var px = d.x + Math.sin(t * 0.42 * d.sp + d.ph) * d.am * 1.05;
      var py = d.y + Math.cos(t * 0.33 * d.sp + d.ph * 1.7) * d.am * 0.75;
      if (d.fall) py = (d.y + t * d.fall + d.ph * 14) % H;

      if (px < -6 || px > W + 6) continue;

      ctx.fillStyle = ink(ci, qa);
      if (d.sq) {
        ctx.fillRect(px - d.s * 0.5, py - d.s * 0.5, d.s, d.s);
      } else {
        var r = d.s * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  function frame(now) {
    if (!running) return;
    if (!t0) t0 = now;
    render((now - t0) * 0.001);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !dots.length) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    t0 = 0;
  }

  /* ---------------------------------------------------------------- wiring */
  if (REDUCED) {
    build();                                    // one still frame, no loop
  } else {
    build();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) start(); else stop();
      }, { threshold: 0 }).observe(host);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (host.getBoundingClientRect().bottom > 0) start();
    });
  }

  /* the mask depends on the font and on the word itself, so both rebuild it */
  var rebuild = (function () {
    var q = 0;
    return function () {
      clearTimeout(q);
      q = setTimeout(function () {
        stop();
        build();
        if (!REDUCED && host.getBoundingClientRect().bottom > 0) start();
      }, 80);
    };
  })();

  var rz = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(rebuild, 180);
  }, { passive: true });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);

  if ('MutationObserver' in window) {
    new MutationObserver(rebuild).observe(src, { childList: true, characterData: true, subtree: true });
  }

  window.__wordmark = { count: function () { return dots.length; } };
})();
