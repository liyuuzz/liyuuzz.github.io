/* ==========================================================================
   content.js — the whole site reads its copy out of content.json.
   Nothing else in the project hard-codes a sentence, so editing that one
   file is the only thing needed to change what the site says.

   Supported attributes
     data-c="a.b.0"        writes text into the element
     data-c-href="a.b"     writes href (mailto:/tel: prefixes preserved)
     data-c-attr="content:a.b"   writes any attribute (attr:path)
     data-c-list="a.b"     repeats the template named in data-tpl
   ========================================================================== */
(function () {
  'use strict';

  function get(obj, path) {
    if (!path) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function bindText(root, scope) {
    var nodes = root.querySelectorAll('[data-c]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-c');
      /* an empty key means "this element is the value" — used by the
         paragraph template, where each list entry is a plain string */
      var v = key === '' ? scope : get(scope, key);
      if (v == null) continue;
      if (typeof v === 'object') continue;
      el.textContent = v;
    }
  }

  function bindHref(root, scope) {
    var nodes = root.querySelectorAll('[data-c-href]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = el.getAttribute('data-c-href');
      var prefix = '';
      var m = /^(mailto|tel|https?):(.*)$/.exec(raw);
      if (m) { prefix = m[1] + ':'; raw = m[2]; }
      var v = get(scope, raw);
      if (v == null || v === '') continue;
      el.setAttribute('href', prefix + v);
    }
  }

  function bindAttr(root, scope) {
    var nodes = root.querySelectorAll('[data-c-attr]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var raw = el.getAttribute('data-c-attr');
      var cut = raw.indexOf(':');
      if (cut < 0) continue;
      var v = get(scope, raw.slice(cut + 1));
      if (v == null) continue;
      el.setAttribute(raw.slice(0, cut), v);
    }
  }

  /* ---- lists ---------------------------------------------------------- */
  function bindList(container) {
    var id = container.getAttribute('data-tpl');
    var items = get(window.__content, container.getAttribute('data-c-list'));
    var tpl = id && document.getElementById(id);
    if (!tpl || !Array.isArray(items)) return;

    var out = document.createDocumentFragment();

    for (var i = 0; i < items.length; i++) {
      var item = items[i] || {};
      var frag = tpl.content.cloneNode(true);
      var node = frag.firstElementChild;
      if (!node) continue;

      bindText(frag, item);
      bindHref(frag, item);
      bindAttr(frag, item);

      /* per-item specifics that are not plain text */
      var link = frag.querySelector('a');
      if (link && item.href) link.setAttribute('href', item.href);

      var img = frag.querySelector('img');
      if (img) {
        if (item.image) {
          img.setAttribute('src', item.image);
          img.setAttribute('alt', item.title || '');
        } else {
          /* no photograph yet: the plate carries the mark as a watermark, so
             an unfinished card still looks deliberate */
          var portal = frag.querySelector('.portal');
          if (portal) portal.classList.add('is-plate');
          var media = frag.querySelector('.portal-media');
          if (media) {
            media.insertAdjacentHTML('beforeend',
              '<svg class="plate-mark" viewBox="0 0 64 64" aria-hidden="true">' +
              '<g fill="none" stroke="rgba(237,233,248,.30)" stroke-width="3.2" stroke-linecap="round">' +
              '<line x1="32" y1="6" x2="32" y2="24"/>' +
              '<line x1="32" y1="6" x2="32" y2="24" transform="rotate(60 32 32)"/>' +
              '<line x1="32" y1="6" x2="32" y2="24" transform="rotate(120 32 32)"/>' +
              '<line x1="32" y1="6" x2="32" y2="24" transform="rotate(180 32 32)"/>' +
              '<line x1="32" y1="6" x2="32" y2="24" transform="rotate(240 32 32)"/>' +
              '<line x1="32" y1="6" x2="32" y2="24" transform="rotate(300 32 32)"/>' +
              '<line x1="32" y1="15" x2="32" y2="24" transform="rotate(30 32 32)"/>' +
              '<line x1="32" y1="15" x2="32" y2="24" transform="rotate(150 32 32)"/>' +
              '<line x1="32" y1="15" x2="32" y2="24" transform="rotate(210 32 32)"/>' +
              '<line x1="32" y1="15" x2="32" y2="24" transform="rotate(270 32 32)"/>' +
              '<line x1="32" y1="15" x2="32" y2="24" transform="rotate(330 32 32)"/>' +
              '</g><circle cx="53" cy="32" r="2.9" fill="rgba(201,168,255,.95)"/></svg>');
          }
          if (img && img.parentNode) img.parentNode.removeChild(img);
        }
      }

      out.appendChild(frag);
    }

    container.innerHTML = '';
    container.appendChild(out);
  }

  function boot(data) {
    window.__content = data;
    bindText(document, data);
    bindHref(document, data);
    bindAttr(document, data);

    var lists = document.querySelectorAll('[data-c-list]');
    for (var i = 0; i < lists.length; i++) bindList(lists[i]);
  }

  window.__contentReady = fetch('content.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      boot(data);
      return data;
    })
    .catch(function (err) {
      document.documentElement.setAttribute('data-content', 'missing');
      var banner = document.createElement('div');
      banner.className = 'content-error';
      banner.innerHTML =
        '文案没有加载出来（<b>' + (err && err.message ? err.message : '读取失败') + '</b>）。' +
        'content.json 需要经由 HTTP 打开 —— 用 <code>python -m http.server</code> 起个本地服务，' +
        '或者直接看线上的 GitHub Pages。';
      document.body.appendChild(banner);
      return null;
    });
})();
