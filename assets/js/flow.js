/* ==========================================================================
   flow.js — how the page moves when you scroll.

   Three things, all of them from one idea: motion that is *driven* by the
   reader but not *slaved* to the wheel. A trackpad delivers a hundred jittery
   events; if every one of them writes a transform, the page shivers. So the
   scroll position is damped once, here, and everything that moves reads the
   damped value.

     1. damp()      one first-order lag on scrollY, shared by every subscriber
     2. hero exit   the first screen stands down in windows, not all at once
     3. word reveal section headings arrive one unit at a time

   The threshold for "settled" is a third of a device pixel: below that the
   loop stops entirely, so a page that is not moving costs nothing.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function smooth(e0, e1, x) {
    var t = clamp01((x - e0) / (e1 - e0 || 1));
    return t * t * (3 - 2 * t);
  }
  function vh() { return window.innerHeight; }

  /* ---- 1. one damped scroll value -------------------------------------- */
  var FLOW = {
    y: 0,            /* damped */
    target: 0,       /* raw */
    subs: [],
    on: function (fn) { this.subs.push(fn); fn(this.y, this.y); }
  };

  var RATE = 11;     /* ≈ 95% in 260ms: enough lag to eat wheel jitter,
                      short enough that the type still feels attached */
  var ticking = false, last = 0;

  function read() {
    FLOW.target = window.pageYOffset || root.scrollTop || 0;
  }

  function tick(now) {
    if (!ticking) return;
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    var d = FLOW.target - FLOW.y;
    FLOW.y += d * (1 - Math.exp(-RATE * dt));
    if (Math.abs(d) < 0.34) FLOW.y = FLOW.target;

    for (var i = 0; i < FLOW.subs.length; i++) FLOW.subs[i](FLOW.y);

    if (FLOW.y === FLOW.target) { ticking = false; return; }
    requestAnimationFrame(tick);
  }

  function wake() {
    if (ticking || REDUCE) return;
    ticking = true;
    last = 0;
    requestAnimationFrame(tick);
  }

  window.addEventListener('scroll', function () {
    read();
    wake();
  }, { passive: true });
  window.addEventListener('resize', function () {
    read();
    if (REDUCE) { FLOW.y = FLOW.target; for (var i = 0; i < FLOW.subs.length; i++) FLOW.subs[i](FLOW.y); }
    else wake();
  }, { passive: true });

  read();
  FLOW.y = FLOW.target;
  if (REDUCE) {
    /* no lag, but the exit still has to be correct at the position we start in */
    window.addEventListener('scroll', function () {
      read(); FLOW.y = FLOW.target;
      for (var i = 0; i < FLOW.subs.length; i++) FLOW.subs[i](FLOW.y);
    }, { passive: true });
  }

  window.__flow = FLOW;

  /* ---- 2. the first screen stands down --------------------------------- */
  /* Everything along the foot of the hero has already done its job by the time
     the walk starts. Letting the block leave together reads as "the page is
     moving"; giving each piece its own window reads as "the hero is standing
     down", which is the quieter and better one.

     Nothing is written until the scroll actually leaves zero, and everything
     is handed back the moment it returns: these elements carry the entrance
     reveal, and an inline opacity at rest would pre-empt it. */
  function wireHeroExit() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    /* The stand-down only works because the hero is pinned while it happens.
       On a phone the hero is taller than the viewport, there is nothing to
       pin, and the same fade would just empty the screen the reader is still
       looking at — so the whole sequence is desktop-only. */
    if (window.matchMedia('(max-width: 900px)').matches) return;

    function q(sel) { return hero.querySelector(sel); }

    /* at = where in the exit it starts, span = how long it takes to go,
       y = how far it has drifted by the time it is gone */
    var seq = [
      /* the first tenth is a hold: the screen has to feel settled before it
         starts taking itself apart, or the title leaves on the first nudge */
      { el: q('.eyebrow'), at: .05, span: .15, y: 14 },
      { el: q('.scroll'), at: .05, span: .12, y: 10 },
      { el: q('.guides'), at: .05, span: .20, y: 0 },
      { el: q('.headline'), at: .15, span: .30, y: 34 },
      { el: q('.lede'), at: .32, span: .24, y: 26 },
      { el: q('.cta'), at: .44, span: .28, y: 20, cut: true },
      { el: q('.ghost-word'), at: .05, span: .50, y: 44 },
      /* the mark is the largest, quietest thing in the frame: a plain fade just
         dims it in place, so it contracts instead, and it keeps a floor — the
         room should not go empty while the pin still holds it on screen */
      { el: q('.mark-wrap'), at: .22, span: .78, y: 22, scale: .92, floor: .40 }
    ].filter(function (o) { return o.el; });

    var on = false;

    function clear() {
      for (var i = 0; i < seq.length; i++) {
        var s = seq[i].el.style;
        s.opacity = ''; s.transform = ''; s.pointerEvents = '';
      }
      on = false;
    }

    FLOW.on(function (y) {
      /* the pin is worth 0.65 of a viewport of scroll; the stand-down has to be
         over by the time it releases, or the next section rises into a hole */
      var t = clamp01(y / Math.max(1, vh() * 0.65));

      if (t <= 0) { if (on) clear(); return; }
      on = true;

      for (var i = 0; i < seq.length; i++) {
        var o = seq[i];
        var a = 1 - smooth(o.at, o.at + o.span, t);      /* 1 → 0 */
        var st = o.el.style;

        /* these carry the reveal's own .8s/1.3s transition, which would
           animate every value written here — the fade would then trail the
           scroll by most of a second and stop reading as scroll-driven */
        st.transition = 'none';
        st.opacity = (o.floor ? o.floor + (1 - o.floor) * a : a).toFixed(3);

        if (o.y || o.scale) {
          var dy = ((1 - a) * o.y).toFixed(1);
          var sc = o.scale ? (o.scale + (1 - o.scale) * a).toFixed(4) : 1;
          st.transform = 'translate3d(0,' + dy + 'px,0)' + (o.scale ? ' scale(' + sc + ')' : '');
        }
        if (o.cut) st.pointerEvents = a < 0.06 ? 'none' : '';
      }
    });
  }

  /* ---- 3. headings arrive a unit at a time ------------------------------ */
  /* Latin splits on spaces. Chinese has none, so the unit is the character —
     which is also how it is read, one glyph after another. */
  var CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;

  function units(text) {
    var out = [];
    var buf = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/\s/.test(ch)) {
        if (buf) { out.push(buf); buf = ''; }
        out.push(' ');
      } else if (CJK.test(ch)) {
        if (buf) { out.push(buf); buf = ''; }
        out.push(ch);
      } else {
        buf += ch;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function split(el) {
    if (el.dataset.wm === '1') return;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    el.dataset.wm = '1';
    el.classList.add('rv-word');
    /* a heading that also carries the page-entrance class would fade up as a
       block while its characters rise separately — two motions for one line */
    el.classList.remove('rise', 'fade');
    el.style.removeProperty('--d');
    el.setAttribute('aria-label', text);
    el.textContent = '';

    var list = units(text), step = 0;
    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      if (u === ' ') { el.appendChild(document.createTextNode(' ')); continue; }
      var mask = document.createElement('span');
      mask.className = 'wm';
      mask.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('i');
      inner.textContent = u;
      inner.style.setProperty('--wd', (step * 46) + 'ms');
      mask.appendChild(inner);
      el.appendChild(mask);
      step++;
    }
  }

  function wireReveals() {
    if (REDUCE) return;

    var WORDS = '.sec-head h2, .closing h2, .page-head h1, #noteTitle';
    var BLOCKS = [
      '.sec-head .label', '.sec-head .lead', '.sec-head .sec-more',
      '.closing .closing-copy > p', '.closing .cta', '.closing .mail-hint',
      '.page-head .lead', '.page-head .label', '.note-back', '.note-date',
      '.about-body > p', '.contact-block', '.facts'
    ].join(',');

    var words = [].slice.call(document.querySelectorAll(WORDS));
    var blocks = [].slice.call(document.querySelectorAll(BLOCKS));
    var cards = [].slice.call(document.querySelectorAll('.work, .note-row'));

    /* the hero has its own entrance; nothing here may touch it */
    words = words.filter(function (el) { return !el.closest('.hero'); });
    blocks = blocks.filter(function (el) { return !el.closest('.hero'); });
    cards = cards.filter(function (el) { return !el.closest('.hero'); });

    for (var i = 0; i < words.length; i++) split(words[i]);

    /* within one group, siblings wait for each other in reading order */
    function stagger(list, step) {
      var byParent = new Map();
      list.forEach(function (el) {
        var key = el.parentElement;
        var arr = byParent.get(key) || [];
        arr.push(el);
        byParent.set(key, arr);
      });
      byParent.forEach(function (arr) {
        arr.forEach(function (el, i) {
          el.style.setProperty('--d', (i * step) + 'ms');
        });
      });
    }
    stagger(blocks, 80);
    stagger(cards, 90);

    blocks.forEach(function (el) { el.setAttribute('data-rv', 'up'); });
    cards.forEach(function (el) { el.setAttribute('data-rv', 'up'); });

    if (!('IntersectionObserver' in window)) {
      words.forEach(function (el) { el.classList.add('rv-in'); });
      blocks.concat(cards).forEach(function (el) { el.classList.add('rv-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].isIntersecting) continue;
        io.unobserve(entries[k].target);
        reveal(entries[k].target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    /* The reveal borrows the element's `transition`, which the card rows and
       the work links also use for their own hover state. Hand the transition
       back once the entrance is over, or hovering a note would snap. Headings
       only carry the marker class and have nothing to hand back.
       transitionend is the fast path; the timer is there because a transition
       that is interrupted (or that Chrome decides not to report, which happens
       when the element is scrolled past mid-flight) would otherwise leave the
       row permanently wearing the entrance transition. */
    function release(el) {
      if (!el.hasAttribute('data-rv')) return;
      el.removeAttribute('data-rv');
      el.classList.remove('rv-in');
      el.style.removeProperty('--d');
    }

    function reveal(el) {
      el.classList.add('rv-in');
      if (!el.hasAttribute('data-rv')) return;
      el.addEventListener('transitionend', function done(e) {
        if (e.propertyName !== 'transform' || e.target !== el) return;
        el.removeEventListener('transitionend', done);
        release(el);
      });
      setTimeout(function () { release(el); }, 1900);
    }

    words.concat(blocks, cards).forEach(function (el) { io.observe(el); });
  }

  /* ---- go --------------------------------------------------------------- */
  function boot() {
    wireHeroExit();
    wireReveals();
  }

  /* the cards and the note body are built from content.json, so the nodes this
     needs do not exist until that fetch lands */
  var ready = window.__contentReady || Promise.resolve();
  ready.then(boot, boot);
})();
