/* ==========================================================================
   shelf.js — the notes page as a shelf of seven volumes.

   The list is no longer a list: each note is a book standing on a plank, one
   of them pulled out and read below. Everything is built from content.json's
   notes.items, so writing an eighth note puts an eighth book on the shelf.

   The books are flat covers turned a few degrees each, not real 3D boxes. At
   this size the spine strip, the gutter shadow and the page edge do all the
   work a fourth face would, and nothing can break when the turn changes.
   ========================================================================== */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  /* Cover colours, in the order the notes appear. Six of them are the
     ultramarine / bone / copper family the shelf is lit by; the two greens
     and the crimson keep the row from reading as one book repeated. */
  var BOOKS = [
    { bg: '#1537a1', foil: '#dce8f5', spine: '#0d2a80', light: true },
    { bg: '#182a43', foil: '#d8a06a', spine: '#101c2e', light: true },
    { bg: '#e6e5df', foil: '#1b1a17', spine: '#c6c5be', light: false },
    { bg: '#7fa7bb', foil: '#123039', spine: '#5d8698', light: false },
    { bg: '#c24d24', foil: '#f4ecdf', spine: '#8d3517', light: true },
    { bg: '#aec400', foil: '#232a08', spine: '#879600', light: false },
    { bg: '#c4301f', foil: '#f0c574', spine: '#8c1f13', light: true }
  ];

  /* One mark per note, drawn in the foil colour. Each is a picture of what
     that note is about: a point, twelve plates, one line, a frame, bands, a
     missing frame, three bars. */
  var MARKS = [
    /* 1 — a single point, off centre */
    '<circle cx="50" cy="56" r="27" fill="none" stroke="currentColor" stroke-width="1" opacity=".42"/>' +
    '<circle cx="50" cy="56" r="43" fill="none" stroke="currentColor" stroke-width=".7" opacity=".20"/>' +
    '<circle cx="74" cy="36" r="4.6" fill="currentColor"/>',
    /* 2 — twelve plates, one missing */
    (function () {
      var out = '';
      for (var i = 0; i < 12; i++) {
        if (i === 2) continue;
        out += '<line x1="50" y1="52" x2="50" y2="26" stroke="currentColor" stroke-width="1.5" ' +
               'stroke-linecap="round" transform="rotate(' + (i * 30) + ' 50 52)"/>';
      }
      return out + '<circle cx="50" cy="52" r="3" fill="currentColor"/>';
    })(),
    /* 3 — one line, and the space around it */
    '<rect x="18" y="18" width="64" height="64" fill="none" stroke="currentColor" stroke-width=".7" opacity=".28"/>' +
    '<line x1="50" y1="27" x2="50" y2="73" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<circle cx="50" cy="50" r="2.4" fill="currentColor"/>',
    /* 4 — a picture inside a frame */
    '<rect x="20" y="24" width="60" height="48" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
    '<rect x="27" y="31" width="46" height="34" fill="none" stroke="currentColor" stroke-width=".7" opacity=".45"/>' +
    '<path d="M27 58 L40 44 L49 53 L58 42 L73 58" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>',
    /* 5 — six bands, the palette itself */
    (function () {
      var out = '';
      for (var i = 0; i < 6; i++) {
        out += '<rect x="' + (26 + i * 4) + '" y="' + (22 + i * 9) + '" width="' + (48 - i * 8) +
               '" height="5" fill="currentColor" opacity="' + (0.95 - i * 0.13).toFixed(2) + '"/>';
      }
      return out;
    })(),
    /* 6 — a frame with a gap in it */
    '<rect x="20" y="22" width="60" height="52" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'stroke-dasharray="34 10 34 10" stroke-linecap="butt"/>' +
    '<line x1="34" y1="38" x2="66" y2="58" stroke="currentColor" stroke-width="1" opacity=".55"/>' +
    '<line x1="66" y1="38" x2="34" y2="58" stroke="currentColor" stroke-width="1" opacity=".55"/>',
    /* 7 — three bars, the three things a case page needs */
    '<rect x="24" y="26" width="52" height="9" fill="currentColor"/>' +
    '<rect x="24" y="44" width="52" height="9" fill="currentColor" opacity=".55"/>' +
    '<rect x="24" y="62" width="30" height="9" fill="currentColor" opacity=".3"/>'
  ];

  var items = [];
  var active = 0;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function bookWidth(title) {
    /* a wide cover for a long subject, expressed as a multiplier so the whole
       row still scales with the viewport instead of being pinned to pixels */
    var n = (title || '').length;
    var q = 1 + Math.max(0, Math.min(0.2, (n - 4) * 0.028));
    return q.toFixed(3);
  }

  function build(row, data) {
    var frag = document.createDocumentFragment();

    for (var i = 0; i < items.length; i++) {
      var note = items[i];
      var tone = BOOKS[i % BOOKS.length];
      var mark = MARKS[i % MARKS.length];

      var book = document.createElement('button');
      book.type = 'button';
      book.className = 'book';
      book.dataset.i = String(i);
      book.setAttribute('aria-label', note.title || '');
      book.style.setProperty('--bc', tone.bg);
      book.style.setProperty('--foil', tone.foil);
      book.style.setProperty('--spine', tone.spine);
      book.style.setProperty('--wq', bookWidth(note.title));
      /* a shelf where every volume is exactly the same height is a shelf
         nobody has ever put a book on */
      book.style.setProperty('--hq', (0.935 + (i % 3) * 0.0325).toFixed(3));
      /* a shallow fan: the ends lean a little more than the middle, so the
         row looks placed rather than printed */
      var mid = (items.length - 1) / 2;
      var fan = (i - mid) * 1.5;
      book.style.setProperty('--fan', fan.toFixed(2) + 'deg');
      book.style.setProperty('--delay', (i * 70) + 'ms');
      book.classList.toggle('is-dark-text', tone.light === false);

      book.innerHTML =
        '<span class="book-cover">' +
          '<span class="book-head"><i>VOL. ' + pad(i + 1) + '</i><i>' + (note.date || '') + '</i></span>' +
          '<span class="book-art" aria-hidden="true"><svg viewBox="0 0 100 100">' + mark + '</svg></span>' +
          '<span class="book-name">' + (note.title || '') + '</span>' +
          '<span class="book-pub">PROFUNFIS</span>' +
        '</span>' +
        '<span class="book-page" aria-hidden="true"></span>';

      frag.appendChild(book);
    }

    row.innerHTML = '';
    row.appendChild(frag);
  }

  function select(i, focus) {
    var row = el('shelfRow');
    var books = document.querySelectorAll('.book');
    if (!books.length) return;
    active = (i + books.length) % books.length;

    for (var k = 0; k < books.length; k++) {
      var on = k === active;
      books[k].classList.toggle('is-on', on);
      if (on) books[k].setAttribute('aria-current', 'true');
      else books[k].removeAttribute('aria-current');
    }

    var note = items[active];
    el('shelfCount').textContent = pad(active + 1) + ' / ' + pad(items.length);
    el('shelfTitle').textContent = note.title || '';
    el('shelfExcerpt').textContent = note.excerpt || '';
    el('shelfOpen').href = note.href || ('note.html?n=' + (active + 1));

    /* on a phone the row is a scroll strip: bring the book that is out to
       the middle instead of leaving it half off the edge */
    if (books[active].scrollIntoView && row.scrollWidth > row.clientWidth + 4) {
      books[active].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    if (focus) books[active].focus({ preventScroll: true });
  }

  function bind() {
    var row = el('shelfRow');

    row.addEventListener('click', function (e) {
      var book = e.target.closest ? e.target.closest('.book') : null;
      if (!book) return;
      var i = +book.dataset.i;
      /* tapping the book that is already out opens it; tapping another one
         just turns to it, so a stray tap never navigates away */
      if (i === active) location.href = el('shelfOpen').href;
      else select(i, false);
    });

    el('shelfPrev').addEventListener('click', function () { select(active - 1, false); });
    el('shelfNext').addEventListener('click', function () { select(active + 1, false); });

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); select(active - 1, false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); select(active + 1, false); }
      else if (e.key === 'Enter') {
        var a = document.activeElement;
        if (a && a.classList && a.classList.contains('book')) {
          e.preventDefault();
          location.href = el('shelfOpen').href;
        }
      }
    });
  }

  (window.__contentReady || Promise.resolve()).then(function (data) {
    if (!data) return;
    items = (data.notes && data.notes.items) || [];
    if (!items.length) return;

    build(el('shelfRow'), data);
    bind();
    select(0, false);

    /* the row settles onto the shelf rather than appearing already standing */
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(function () { el('shelfRow').classList.add('is-up'); });
    } else {
      el('shelfRow').classList.add('is-up');
    }
  });
})();
