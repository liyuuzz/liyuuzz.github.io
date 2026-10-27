/* ==========================================================================
   nav.js — leaving one page for another.

   A static site has no router, so a "transition" is really two half-moves on
   either side of a document load: a curtain down, a curtain up. Both halves
   are driven from here, and the second half is armed by a flag in
   sessionStorage that the head script turns into a class before first paint —
   which is the only way to have the new page start covered without a flash.

   The curtain exists so the load itself is invisible: content.json is a fetch,
   and a fetch is long enough to see.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COVER = REDUCED ? 0 : 210;      /* ms of curtain before we leave */
  var HOLD = REDUCED ? 0 : 900;       /* longest we will hold the curtain up */
  var BEAT = REDUCED ? 0 : 90;        /* shortest, so the curtain reads */

  function parse(a) {
    try { return new URL(a.getAttribute('href'), location.href); } catch (e) { return null; }
  }
  function samePlace(u) {
    return u.pathname === location.pathname && u.search === location.search;
  }

  /* ---- arrival ---------------------------------------------------------- */
  /* html.is-arriving is set in <head>, so the curtain is already covering the
     viewport on the first paint. Drop it once there is something behind it. */
  (function uncover() {
    if (!root.classList.contains('is-arriving')) return;

    /* Held from the very first frame of this document, not from the moment the
       curtain lifts: content.json builds the cards, and the reveal code asks
       whether this class is present before deciding to play its wipe. Set it
       late and every card assembles itself in front of the reader. */
    root.classList.add('curtain-arrived');

    var ready = window.__contentReady || Promise.resolve();
    var cap = new Promise(function (r) { setTimeout(r, HOLD); });
    var beat = new Promise(function (r) { setTimeout(r, BEAT); });
    Promise.all([Promise.race([ready, cap]), beat]).then(function () {
      /* the curtain is the entrance, so the page behind it should already be
         finished when it lifts */
      document.body.classList.add('is-ready', 'intro-done');
      /* two frames: one to paint the finished page behind the curtain, one to
         let the transition start from the covered state */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          root.classList.remove('is-arriving');
          /* the class pins the entrance elements still; it must not outlive
             the reveal, or the dock would stop reacting to the pointer */
          setTimeout(function () {
            root.classList.remove('curtain-arrived');
          }, 700);
        });
      });
    });
  })();

  /* ---- prefetch --------------------------------------------------------- */
  var asked = {};
  document.addEventListener('pointerover', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var u = parse(a);
    if (!u || u.origin !== location.origin || samePlace(u)) return;
    if (asked[u.href]) return;
    asked[u.href] = 1;
    var l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = u.href;
    l.as = 'document';
    document.head.appendChild(l);
  }, { passive: true });

  /* ---- departure -------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;

    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#') return;

    var u = parse(a);
    if (!u || u.origin !== location.origin || samePlace(u)) return;

    e.preventDefault();
    try { sessionStorage.setItem('nav-leaving', '1'); } catch (err) {}

    root.classList.add('is-leaving');
    window.setTimeout(function () { location.assign(u.href); }, COVER);
  });

  window.addEventListener('pageshow', function (e) {
    /* back/forward: the document may come out of the bfcache still covered */
    if (e.persisted) {
      root.classList.remove('is-leaving', 'is-arriving');
      try { sessionStorage.removeItem('nav-leaving'); } catch (err) {}
    }
  });

  /* ---- mailto with a floor under it ------------------------------------- */
  /* A mailto: with no registered handler is silently swallowed by Windows and
     by most Linux desktops: the click reads as broken. Copying always works,
     and the address is offered next to the confirmation for people who do have
     a client. */
  var toast = null, toastTimer = 0;
  function say(msg) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    void toast.offsetWidth;                    /* restart the entrance */
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 4200);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    /* the escape hatch inside the confirmation must stay a real mailto */
    if (a.closest('.mail-hint')) return;
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;

    var addr = decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]);
    if (!addr) return;

    e.preventDefault();
    var copy = (window.__content && window.__content.closing) || {};

    navigator.clipboard.writeText(addr).then(function () {
      var lbl = a.querySelector('.cta-lbl');
      if (lbl) {
        if (!lbl.dataset.orig) lbl.dataset.orig = lbl.textContent;
        lbl.textContent = copy.copied || '已复制';
        clearTimeout(lbl._t);
        lbl._t = setTimeout(function () { lbl.textContent = lbl.dataset.orig; }, 3800);
      }
      var hint = a.parentNode && a.parentNode.querySelector('.mail-hint');
      if (hint) hint.hidden = false;
      else say((copy.copied || '已复制') + ' · ' + addr);
    }).catch(function () {
      /* clipboard refused (insecure context, permission): let the protocol
         handler have a go after all */
      location.href = 'mailto:' + addr;
    });
  });
})();
