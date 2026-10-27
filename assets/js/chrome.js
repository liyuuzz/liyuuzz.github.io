/* ==========================================================================
   chrome.js — everything that is not the hero artwork.
   One requestAnimationFrame drives the dock springs, the specular rims and
   the pointer parallax, so the page never runs three loops to move pixels.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover:hover) and (pointer:fine)');

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fineHover() { return !REDUCED && FINE.matches; }

  /* ---- current section in the dock ------------------------------------ */
  (function markActive() {
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var items = document.querySelectorAll('.dock [data-dock]');
    for (var i = 0; i < items.length; i++) {
      /* the mark tile and the outbound pill are not sections — marking either
         of them active would put two highlights in a five-item bar */
      var skip = items[i].classList.contains('dock-mark') ||
                 items[i].classList.contains('dock-item--enter');
      var href = (items[i].getAttribute('href') || '').split('#')[0].toLowerCase();
      items[i].classList.remove('is-active');
      if (!skip && href && href === here) items[i].classList.add('is-active');
    }
  })();

  /* ---- intro ----------------------------------------------------------- */
  function startIntro() {
    /* The pre-intro styles come from .js on <html>, set while the head was
       parsing. Without a forced recalc the browser computes them once, sees
       the finished state, and skips every transition. */
    void document.body.offsetHeight;
    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
      window.setTimeout(function () {
        document.body.classList.add('intro-done');
      }, REDUCED ? 0 : 2900);
    });
  }
  (window.__contentReady || Promise.resolve()).then(startIntro);

  /* ---- pointer state --------------------------------------------------- */
  var aim = { x: 0, y: 0, seen: false, moved: false };
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    aim.x = e.clientX; aim.y = e.clientY; aim.seen = true; aim.moved = true;
    DOCK.dirty = SPEC.dirty = true;
  }, { passive: true });
  window.addEventListener('pointerleave', function () {
    aim.seen = false;
    dockRest();
    for (var i = 0; i < SPEC.items.length; i++) SPEC.items[i].tBr = SPEC.items[i].focused ? 0.9 : 0;
    SPEC.dirty = true;
  });

  /* ====================================================================== *
   * dock — pills grow as the pointer nears them
   * ====================================================================== */
  var DOCK = { root: null, items: [], on: false, key: false, dirty: false, u: 1 };
  var SPEC = { items: [], on: false, dirty: false };
  var stage = document.getElementById('stage');

  function measureDock() {
    if (!DOCK.root) return;
    DOCK.on = fineHover();
    /* one design unit, expressed in CSS pixels: the stage is exactly 1600u
       wide, so the viewport divided by the reference width is the same value
       the stylesheet derives — clamped the way --u is on very wide screens */
    var narrow = window.innerWidth <= 900;
    DOCK.u = Math.min(document.documentElement.clientWidth, 1900) / (narrow ? 760 : 1600);
    for (var i = 0; i < DOCK.items.length; i++) {
      var st = DOCK.items[i];
      st.el.style.width = st.el.style.height = st.el.style.transform = '';
      st.el.setAttribute('data-near', 'false');
      st.v = st.vel = st.target = 0;
      st.touched = false;
    }
    for (var j = 0; j < DOCK.items.length; j++) {
      var r = DOCK.items[j].el.getBoundingClientRect();
      DOCK.items[j].w = r.width;
      DOCK.items[j].h = r.height;
    }
    DOCK.dirty = true;
  }

  function dockRest() {
    for (var i = 0; i < DOCK.items.length; i++) {
      DOCK.items[i].target = 0;
      DOCK.items[i].el.setAttribute('data-near', 'false');
    }
    DOCK.dirty = true;
  }

  function drawDock(dt) {
    if (!DOCK.root || !DOCK.on) return;

    /* Targets are recomputed only when the pointer actually moved. Deriving
       them every frame from a stale position oscillates: the capsule is
       centred, so a growing pill shifts the bar sideways, which slides a
       different pill under a stationary cursor, which grows instead. */
    if (aim.seen && aim.moved && !DOCK.key) {
      var rr = DOCK.root.getBoundingClientRect();
      if (aim.x > rr.left - 48 && aim.x < rr.right + 48 &&
          aim.y > rr.top - 44 && aim.y < rr.bottom + 104) {
        for (var i = 0; i < DOCK.items.length; i++) {
          var st = DOCK.items[i];
          var r = st.el.getBoundingClientRect();
          var prox = clamp01(1 - Math.abs(aim.x - (r.left + r.width * 0.5)) / (128 * DOCK.u));
          st.target = prox * prox * (3 - 2 * prox);
          st.el.setAttribute('data-near', st.target > 0.08 ? 'true' : 'false');
        }
        DOCK.dirty = true;
      } else {
        for (var k = 0; k < DOCK.items.length; k++) {
          if (DOCK.items[k].target !== 0) { dockRest(); break; }
        }
      }
    }

    if (!DOCK.dirty) return;
    var moving = false;
    for (var j = 0; j < DOCK.items.length; j++) {
      var it = DOCK.items[j];
      it.vel += (it.target - it.v) * 190 * dt;
      it.vel *= Math.exp(-23 * dt);
      it.v += it.vel * dt;
      if (Math.abs(it.target - it.v) < 0.001 && Math.abs(it.vel) < 0.004) { it.v = it.target; it.vel = 0; }
      else moving = true;

      var v = Math.min(Math.max(it.v, 0), 1.08);
      var mark = it.el.classList.contains('dock-mark');
      var ew = mark ? 14 * DOCK.u : Math.min(18 * DOCK.u, it.w * 0.24);
      var eh = mark ? 14 * DOCK.u : 16 * DOCK.u;
      it.el.style.width = (it.w + ew * v).toFixed(2) + 'px';
      it.el.style.height = (it.h + eh * v).toFixed(2) + 'px';
      it.el.style.transform = 'translateY(' + (v * 3.5 * DOCK.u).toFixed(2) + 'px)';
    }
    if (!moving) DOCK.dirty = false;
  }

  /* ====================================================================== *
   * specular rim — a conic gradient pointed at the pointer
   * ====================================================================== */
  function drawSpec(dt) {
    if (!SPEC.on) return;

    if (aim.seen && aim.moved) {
      for (var i = 0; i < SPEC.items.length; i++) {
        var st = SPEC.items[i];
        var r = st.el.getBoundingClientRect();
        var cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5;
        var dx = Math.max(r.left - aim.x, 0, aim.x - r.right);
        var dy = Math.max(r.top - aim.y, 0, aim.y - r.bottom);
        var d = Math.sqrt(dx * dx + dy * dy);
        st.tAng = d === 0
          ? Math.atan2(2 / Math.max(r.height, 1), -2 / Math.max(r.width, 1)) +
            ((aim.x - cx) / Math.max(r.width * 0.5, 1)) * 0.30 +
            ((cy - aim.y) / Math.max(r.height * 0.5, 1)) * 0.15
          : Math.atan2(cy - aim.y, aim.x - cx);
        var raw = clamp01(1 - d / (st.reach * DOCK.u));
        st.tBr = Math.max(raw * raw * (3 - 2 * raw), st.focused ? 0.9 : 0);
      }
      SPEC.dirty = true;
    }

    if (!SPEC.dirty) return;
    var moving = false;
    for (var j = 0; j < SPEC.items.length; j++) {
      var it = SPEC.items[j];
      var diff = ((it.tAng - it.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      it.ang += diff * (1 - Math.exp(-dt * 8));
      it.br += (it.tBr - it.br) * (1 - Math.exp(-dt * 9));
      if (Math.abs(diff) < 0.001 && Math.abs(it.tBr - it.br) < 0.002) { it.ang = it.tAng; it.br = it.tBr; }
      else moving = true;
      it.el.style.setProperty('--spec-angle', it.ang.toFixed(4) + 'rad');
      it.el.style.setProperty('--spec-bright', (clamp01(it.br) * 0.92).toFixed(3));
    }
    if (!moving) SPEC.dirty = false;
  }

  function initDock() {
    var root = document.querySelector('.dock');
    if (!root) return;
    DOCK.root = root;
    DOCK.items = [].map.call(root.querySelectorAll('[data-dock]'), function (el) {
      return { el: el, w: 0, h: 0, v: 0, vel: 0, target: 0 };
    });
    SPEC.items = [].map.call(document.querySelectorAll('[data-spec]'), function (el) {
      return {
        el: el, ang: 2.4, tAng: 2.4, br: 0, tBr: 0, focused: false,
        reach: el.classList.contains('dock') ? 250 : 185
      };
    });
    SPEC.on = fineHover();

    measureDock();
    /* the labels set the pill widths, so the base measure is wrong until the
       real face has landed */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureDock);
    window.addEventListener('resize', measureDock);

    root.addEventListener('focusin', function (e) {
      var item = e.target.closest('[data-dock]');
      if (!item || !DOCK.on) return;
      var nodes = DOCK.items.map(function (st) { return st.el; });
      var idx = nodes.indexOf(item);
      DOCK.items.forEach(function (st, i) {
        st.target = i === idx ? 1 : Math.abs(i - idx) === 1 ? 0.24 : 0;
        st.el.setAttribute('data-near', st.target > 0.08 ? 'true' : 'false');
      });
      DOCK.key = true; DOCK.dirty = true;
    });
    root.addEventListener('focusout', function () {
      requestAnimationFrame(function () {
        if (!root.contains(document.activeElement)) { DOCK.key = false; dockRest(); }
      });
    });
    for (var i = 0; i < SPEC.items.length; i++) (function (st) {
      st.el.addEventListener('focusin', function () { st.focused = true; SPEC.dirty = true; });
      st.el.addEventListener('focusout', function () { st.focused = false; SPEC.dirty = true; });
    })(SPEC.items[i]);

    /* clicking a section moves the active pill */
    root.addEventListener('click', function (e) {
      var item = e.target.closest('[data-dock]');
      if (!item || item.classList.contains('dock-mark') || item.classList.contains('dock-item--enter')) return;
      for (var j = 0; j < DOCK.items.length; j++) DOCK.items[j].el.classList.remove('is-active');
      item.classList.add('is-active');
    });
  }

  /* ====================================================================== *
   * parallax — one value pair published on .hero, CSS does the rest
   * ====================================================================== */
  /* the mark canvas is left out on purpose: it carries its own pointer tilt
     inside the canvas, and a CSS transform here would fight the intro's
     scale-down (two rules writing transform on one element) */
  var PARALLAX = '.dock,.headline,.lede,.cta,.stat-row,.scroll';
  var hero = document.getElementById('hero');
  var pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  var lastX = null, lastY = null, parOn = false;

  function startParallax() {
    if (REDUCED || parOn || !hero) return;
    parOn = true;
    var nodes = document.querySelectorAll(PARALLAX);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('par');
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    window.addEventListener('pointerleave', function () { pointer.x = pointer.y = 0; });
  }

  function drawParallax() {
    if (!parOn) return;
    smooth.x += (pointer.x - smooth.x) * 0.055;
    smooth.y += (pointer.y - smooth.y) * 0.055;
    /* three decimals is finer than a pixel of travel, and rounding lets the
       writes stop entirely once the pointer settles */
    var nx = Math.round(smooth.x * 1000) / 1000;
    var ny = Math.round(smooth.y * 1000) / 1000;
    if (nx !== lastX || ny !== lastY) {
      lastX = nx; lastY = ny;
      hero.style.setProperty('--px', nx);
      hero.style.setProperty('--py', ny);
    }
  }

  /* ====================================================================== *
   * the single frame loop
   * ====================================================================== */
  var lastTick = 0, ticking = false;
  function tick() {
    if (!ticking) return;
    var now = performance.now();
    var dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 0.016;
    lastTick = now;
    drawDock(dt);
    drawSpec(dt);
    drawParallax();
    aim.moved = false;
    requestAnimationFrame(tick);
  }
  function startTick() {
    if (ticking) return;
    ticking = true;
    lastTick = 0;
    requestAnimationFrame(tick);
  }
  function stopTick() { ticking = false; }

  /* ====================================================================== *
   * portal reveals — a stepped clip with sampled dots along the edge
   * ====================================================================== */
  var CUT_STEPS = 12, CUT_MS = 1050;

  function revealPortal(fig) {
    if (fig.dataset.revealed === '1') return;
    fig.dataset.revealed = '1';

    /* arriving through the page curtain: the whole point is that the page is
       finished before it is revealed, so the card does not assemble itself in
       front of the reader — it is simply there */
    if (document.documentElement.classList.contains('curtain-arrived')) {
      fig.classList.add('is-instant', 'is-live');
      return;
    }

    var canvasEl = fig.querySelector('.pixel-reveal');
    var media = fig.querySelector('.portal-media');
    var img = fig.querySelector('img');
    if (!canvasEl || !media) return;

    fig.classList.add('is-live');
    if (REDUCED) return;

    function launch() {
      var box = canvasEl.getBoundingClientRect();
      if (!box.width || !box.height) return;

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.max(1, Math.round(box.width * dpr));
      canvasEl.height = Math.max(1, Math.round(box.height * dpr));
      var ctx = canvasEl.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var cols = 46;
      var rows = Math.max(16, Math.round(cols * box.height / box.width));

      var rgba = null;
      if (img && img.complete && img.naturalWidth) {
        var sample = document.createElement('canvas');
        sample.width = cols; sample.height = rows;
        var sg = sample.getContext('2d', { willReadFrequently: true });
        try {
          sg.drawImage(img, 0, 0, cols, rows);
          rgba = sg.getImageData(0, 0, cols, rows).data;
        } catch (err) { rgba = null; }
      }

      /* layout offsets, not bounding rects — .portal-media carries a live
         transform and its rect would drift */
      var over = -media.offsetLeft;
      var span = media.offsetWidth;
      var reach = box.width;
      var startedAt = performance.now();

      canvasEl.style.opacity = '1';

      function paint(now) {
        var t = Math.min(1, (now - startedAt) / CUT_MS);
        var stepped = Math.floor(t * CUT_STEPS) / CUT_STEPS;
        var front = (stepped * span - over) / reach;
        var tailFade = t < .88 ? 1 : (1 - t) / .12;
        ctx.clearRect(0, 0, box.width, box.height);

        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            var an = (x + .5) / cols;
            var delta = an - front;
            if (delta < -.16 || delta > .16) continue;

            var band = 1 - Math.abs(delta) / .16;
            var pulse = .68 + .32 * Math.sin(x * 2.71 + y * 1.93 + t * 26);
            var alpha = Math.max(0, band * pulse * tailFade);
            if (alpha < .08) continue;

            var r = 220, g = 238, b = 202;
            if (rgba) {
              var q = (y * cols + x) * 4;
              r = Math.min(255, rgba[q] * 1.18 + 20);
              g = Math.min(255, rgba[q + 1] * 1.18 + 24);
              b = Math.min(255, rgba[q + 2] * 1.12 + 14);
            }

            var px = (x + .5) * box.width / cols;
            var py = (y + .5) * box.height / rows;
            var jitter = (1 - band) * 4;
            px += Math.sin(y * 3.17 + x) * jitter;
            py += Math.cos(x * 2.41 - y) * jitter;
            var radius = (.55 + band * 1.25) * Math.max(.75, reach / 320);

            ctx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + (alpha * .92) + ')';
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (t < 1) requestAnimationFrame(paint);
        else {
          ctx.clearRect(0, 0, box.width, box.height);
          canvasEl.style.opacity = '0';
        }
      }
      requestAnimationFrame(paint);
    }

    if (img && !img.complete) img.addEventListener('load', launch, { once: true });
    else launch();
  }

  function initPortals() {
    var figs = document.querySelectorAll('.portal');
    if (!figs.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < figs.length; i++) revealPortal(figs[i]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        revealPortal(en.target);
      });
    }, { threshold: 0.35 });
    for (var j = 0; j < figs.length; j++) io.observe(figs[j]);
  }

  /* ---- go ------------------------------------------------------------- */
  /* Links that have not been given a destination yet are authored as href="#".
     Left alone, clicking one scrolls the page to the top, which reads as a
     broken link. Swallow it until the copy is filled in. */
  function guardPlaceholders() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href="#"],a[href=""]') : null;
      if (a) e.preventDefault();
    });
  }

  function boot() {
    initDock();
    startParallax();
    startTick();
    guardPlaceholders();

    /* The portal cards do not exist yet: content.json builds them. Observing
       at DOMContentLoaded found zero .portal nodes, so nothing was ever
       revealed and every card stayed clipped until the intro's 2.9s timer
       dropped the clips wholesale — which is why a freshly loaded works page
       sat there as three empty rectangles. */
    (window.__contentReady || Promise.resolve()).then(initPortals, initPortals);

    /* everything the tick loop drives lives in the hero, so there is nothing
       to animate once it has scrolled away */
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) startTick(); else stopTick();
      }, { threshold: 0 }).observe(hero);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
