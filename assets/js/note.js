/* ==========================================================================
   note.js — one note, read from content.json.
   The note list is the only index; the reader takes ?n=<1-based position>
   so a note can be linked without inventing a second copy of its title.
   ========================================================================== */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function fill(text, node) {
    if (node) node.textContent = text || '';
  }

  function missing(data) {
    var copy = (data && data.pages && data.pages.note) || {};
    var body = el('noteBody');
    fill(copy.missing || '没有这篇。', el('noteTitle'));
    fill(copy.missing_text || '', el('noteExcerpt'));
    if (body) {
      body.innerHTML = '';
      var back = document.createElement('a');
      back.className = 'note-back';
      back.href = 'notes.html';
      back.textContent = copy.back || '全部笔记';
      body.appendChild(back);
    }
    var nav = document.querySelector('.note-nav');
    if (nav) nav.hidden = true;
  }

  function step(link, note, arrow, dir) {
    if (!link) return;
    if (!note) { link.hidden = true; return; }
    link.hidden = false;
    link.href = 'note.html?n=' + note.n;
    link.textContent = dir === 'prev' ? arrow + ' ' + note.title : note.title + ' ' + arrow;
    link.setAttribute('aria-label', note.title);
  }

  (window.__contentReady || Promise.resolve()).then(function (data) {
    if (!data) return;

    var items = (data.notes && data.notes.items) || [];
    var hasParam = /[?&]n=/.test(location.search);
    var raw = parseInt(new URLSearchParams(location.search).get('n'), 10);
    /* an address that names a note that does not exist should say so, not
       quietly serve the first one under the wrong title */
    if (hasParam && !(raw >= 1 && raw <= items.length)) { missing(data); return; }
    var idx = hasParam ? raw - 1 : 0;
    var note = items[idx];

    if (!note) { missing(data); return; }

    var name = (data.site && data.site.name) || '';
    document.title = (note.title || '') + (name ? '｜' + name : '');

    var meta = document.querySelector('meta[name="description"]');
    if (meta && note.excerpt) meta.setAttribute('content', note.excerpt);

    fill(note.title, el('noteTitle'));
    fill(note.excerpt, el('noteExcerpt'));
    fill(note.date, el('noteDate'));

    var body = el('noteBody');
    if (body) {
      body.innerHTML = '';
      var paras = note.body || [];
      for (var i = 0; i < paras.length; i++) {
        var p = document.createElement('p');
        /* a line that is short and ends in a period reads as a beat, not a
           paragraph — give it the accent so the eye slows down there */
        if (paras[i].length <= 14) p.className = 'prose-beat';
        p.textContent = paras[i];
        body.appendChild(p);
      }
    }

    var newer = items[idx - 1] ? Object.assign({ n: idx }, items[idx - 1]) : null;
    var older = items[idx + 1] ? Object.assign({ n: idx + 2 }, items[idx + 1]) : null;
    step(el('notePrev'), newer, '←', 'prev');
    step(el('noteNext'), older, '→', 'next');
  });
})();
