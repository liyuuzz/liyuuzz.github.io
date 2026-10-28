/* ==========================================================================
   case.js — one work, read from content.json.
   Same contract as note.js: the list is the only index, and ?w=<n> is the
   one-based position in it, so a case can be linked without a second copy of
   its title living in the markup.

   The page is allowed to borrow the case's colour (--case) but not its
   typography: six designs should read as six pictures in one book, not as six
   books.
   ========================================================================== */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function fill(text, node) {
    if (node) node.textContent = text || '';
  }

  function missing(data) {
    var copy = (data && data.pages && data.pages.work) || {};
    fill(copy.missing || '没有这件作品。', el('caseTitle'));
    fill(copy.missing_text || '', el('caseLead'));
    var facts = el('caseFacts');
    if (facts) facts.innerHTML = '';
    var details = el('caseDetails');
    if (details) details.innerHTML = '';
    var h2 = el('caseH2');
    if (h2) h2.hidden = true;
    /* the framing goes with the picture: an empty plate with a glow around it
       reads as a failed image, which is exactly what this state is not */
    var hero = document.querySelector('.case-hero');
    if (hero) hero.remove();
    var aside = document.querySelector('.case-aside');
    if (aside) aside.hidden = true;
    /* no second escape hatch in the body: the header already carries 全部作品,
       and two of them on an otherwise empty page look like a mistake */
    var body = el('caseBody');
    if (body) body.innerHTML = '';
    var nav = document.querySelector('.note-nav');
    if (nav) nav.hidden = true;
  }

  function step(link, work, arrow, dir) {
    if (!link) return;
    if (!work) { link.hidden = true; return; }
    link.hidden = false;
    link.href = 'work.html?w=' + work.w;
    link.textContent = dir === 'prev' ? arrow + ' ' + work.title : work.title + ' ' + arrow;
    link.setAttribute('aria-label', work.title);
  }

  /* The hero drifts against the page as it passes. The image is already scaled
     6% by its own rule, so a few pixels of travel never exposes an edge — the
     same trick the cards use, one axis only. Damped and self-stopping: this
     must not keep a frame loop alive on a finished page. */
  function drift(img) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var at = 0, want = 0, raf = 0, live = false;
    var LIMIT = 26;   /* px of travel at most */

    function read() {
      var box = img.parentNode.getBoundingClientRect();
      var mid = box.top + box.height / 2 - innerHeight / 2;
      var t = Math.max(-1, Math.min(1, mid / (innerHeight * 0.9)));
      want = -t * LIMIT;
    }

    function tick() {
      at += (want - at) * 0.12;
      if (Math.abs(want - at) < 0.4) {
        at = want;
        img.style.transform = 'scale(1.06) translate3d(0,' + at.toFixed(1) + 'px,0)';
        live = false;
        return;
      }
      img.style.transform = 'scale(1.06) translate3d(0,' + at.toFixed(1) + 'px,0)';
      raf = requestAnimationFrame(tick);
    }

    function wake() {
      read();
      if (!live) { live = true; raf = requestAnimationFrame(tick); }
    }

    addEventListener('scroll', wake, { passive: true });
    addEventListener('resize', wake, { passive: true });
    read();
    at = want;
    img.style.transform = 'scale(1.06) translate3d(0,' + at.toFixed(1) + 'px,0)';
  }

  (window.__contentReady || Promise.resolve()).then(function (data) {
    if (!data) return;

    var items = (data.works && data.works.items) || [];
    var hasParam = /[?&]w=/.test(location.search);
    var raw = parseInt(new URLSearchParams(location.search).get('w'), 10);
    if (hasParam && !(raw >= 1 && raw <= items.length)) { missing(data); return; }
    var idx = hasParam ? raw - 1 : 0;
    var work = items[idx];

    if (!work) { missing(data); return; }

    var name = (data.site && data.site.name) || '';
    document.title = (work.title || '') + (name ? '｜' + name : '');

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', work.lead || work.desc || '');

    /* the case colour, applied once at the root so every nested rule can use
       it without each one knowing where the value came from */
    if (work.accent) document.documentElement.style.setProperty('--case', work.accent);

    fill(work.label, el('caseLabel'));
    fill(work.title, el('caseTitle'));
    fill(work.lead || work.desc, el('caseLead'));

    var hero = el('caseHero');
    if (hero) {
      hero.src = work.wide || work.image || '';
      hero.alt = work.title || '';
      drift(hero);
    }

    var facts = el('caseFacts');
    if (facts) {
      facts.innerHTML = '';
      var rows = work.meta || [];
      for (var i = 0; i < rows.length; i++) {
        var row = document.createElement('div');
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = rows[i].k || '';
        dd.textContent = rows[i].v || '';
        row.appendChild(dt);
        row.appendChild(dd);
        facts.appendChild(row);
      }
    }

    var palette = el('casePalette');
    var swatchRow = el('casePaletteRow');
    if (palette && swatchRow && work.palette && work.palette.length) {
      palette.hidden = false;
      swatchRow.innerHTML = '';
      for (var j = 0; j < work.palette.length; j++) {
        var sw = document.createElement('i');
        sw.style.background = work.palette[j];
        sw.title = work.palette[j];
        swatchRow.appendChild(sw);
      }
    }

    var body = el('caseBody');
    if (body) {
      body.innerHTML = '';
      var paras = work.body || [];
      for (var k = 0; k < paras.length; k++) {
        var p = document.createElement('p');
        /* same rule as the notes: a short line ending in a stop is a beat,
           and gets the accent so the eye slows down there */
        if (paras[k].length <= 14) p.className = 'prose-beat';
        p.textContent = paras[k];
        body.appendChild(p);
      }
    }

    var details = el('caseDetails');
    if (details) {
      details.innerHTML = '';
      var list = work.details || [];
      for (var m = 0; m < list.length; m++) {
        var box = document.createElement('div');
        box.className = 'case-detail';
        var h3 = document.createElement('h3');
        var txt = document.createElement('p');
        h3.textContent = list[m].k || '';
        txt.textContent = list[m].v || '';
        box.appendChild(h3);
        box.appendChild(txt);
        details.appendChild(box);
      }
      if (!list.length) {
        var h2 = el('caseH2');
        if (h2) h2.hidden = true;
      }
    }

    var newer = items[idx - 1] ? Object.assign({ w: idx }, items[idx - 1]) : null;
    var older = items[idx + 1] ? Object.assign({ w: idx + 2 }, items[idx + 1]) : null;
    step(el('casePrev'), newer, '←', 'prev');
    step(el('caseNext'), older, '→', 'next');
  });
})();
