/* ==========================================================================
   crt.js — the page a work goes to before it has been written.

   A WebGL pass over an offscreen 2D canvas: the log is typed there, then the
   shader bends it, scans it, splits its colour channels and lets it bloom into
   the glass. Same idea as the reference terminal, re-tinted for this site —
   phosphor is violet here, not green.

   If WebGL is missing the text canvas is simply shown as-is, so the message
   still arrives, just without the tube.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('crtStage');
  var cv = document.getElementById('crtCanvas');
  if (!host || !cv) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BG = '#0A0614';
  var MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
  var SANS = '"Inter Tight", "Inter", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif';

  var INK = {
    p: { fill: '#D9C8FF', glow: 'rgba(150,110,255,0.95)' },
    d: { fill: '#7E6BA8', glow: 'rgba(120,90,200,0.42)' },
    a: { fill: '#E2794F', glow: 'rgba(226,121,79,0.95)' },
    h: { fill: '#F6F0FF', glow: 'rgba(200,168,255,0.95)' }
  };

  var idx = 1;
  var m = /[?&]w=(\d+)/.exec(location.search);
  if (m) idx = Math.max(1, parseInt(m[1], 10) || 1);
  var title = '';

  var LOG = [
    ['PROFUNFIS  ::  TERMINAL', 'p'],
    ['v1.0      hand-written / no build step', 'd'],
    ['', 'd'],
    ['> mount    /works/' + idx, 'd'],
    ['> load     title         OK', 'p'],
    ['> load     body          EMPTY', 'a'],
    ['> load     screenshots   EMPTY', 'a'],
    ['> render   page          FAILED', 'h'],
    ['', 'd']
  ];

  var MAXC = 44;
  var TOTAL = LOG.reduce(function (n, l) { return n + l[0].length; }, 0);

  var text = document.createElement('canvas');
  var tx = text.getContext('2d', { alpha: false });
  var width = 1, height = 1, fs = 14, lh = 20, charW = 8, top = 0;

  /* ---- 2D: the screen itself ------------------------------------------- */
  function layout(w, h) {
    width = w; height = h;
    top = Math.round(h * 0.19);
    lh = h * 0.056;
    fs = Math.max(6, Math.min(lh * 0.66, w * 0.86 / (MAXC * 0.60)));
    tx.font = '600 ' + fs.toFixed(2) + 'px ' + MONO;
    charW = tx.measureText('M').width || fs * 0.6;
  }

  function setInk(key, glow) {
    var c = INK[key];
    tx.fillStyle = c.fill;
    tx.shadowColor = glow ? c.glow : 'transparent';
    tx.shadowBlur = glow ? fs * 0.36 : 0;
  }

  function drawScreen(reveal, fade) {
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.fillStyle = BG;
    tx.fillRect(0, 0, width, height);
    tx.textAlign = 'left';
    tx.textBaseline = 'top';
    tx.font = '600 ' + fs.toFixed(2) + 'px ' + MONO;

    var x0 = Math.round((width - MAXC * charW) / 2);
    var y = top, caretX = x0, caretY = top, left = reveal;

    for (var i = 0; i < LOG.length; i++) {
      var line = LOG[i][0], key = LOG[i][1];
      var take = reveal === Infinity ? line.length : Math.min(left, line.length);
      if (take > 0) {
        var part = line.slice(0, take);
        setInk(key, true);
        tx.fillText(part, x0, y);
        setInk(key, false);
        tx.fillText(part, x0, y);
        caretX = x0 + take * charW;
      }
      caretY = y;
      if (reveal !== Infinity) { left -= line.length; if (left <= 0) break; }
      y += lh;
    }

    /* the Chinese part is set normally — a monospace grid would punish it */
    if (fade > 0.01) {
      var cy = top + lh * (LOG.length + 0.9);
      var size = Math.min(width * 0.030, lh * 0.92);
      tx.globalAlpha = fade;
      tx.textAlign = 'center';
      tx.textBaseline = 'middle';
      tx.font = '500 ' + size.toFixed(2) + 'px ' + SANS;
      tx.shadowColor = INK.p.glow;
      tx.shadowBlur = size * 0.5;
      tx.fillStyle = INK.p.fill;
      tx.fillText(title || '未命名', width / 2, cy);
      tx.shadowBlur = size * 0.34;
      tx.font = '400 ' + (size * 0.86).toFixed(2) + 'px ' + SANS;
      tx.fillStyle = 'rgba(201,168,255,0.88)';
      tx.fillText('这一页还没写。', width / 2, cy + size * 1.55);
      tx.fillStyle = 'rgba(126,107,168,0.75)';
      tx.fillText('先把它接到这里，比留一个死链好。', width / 2, cy + size * 2.7);
      tx.shadowBlur = 0;
      tx.globalAlpha = 1;
    }

    return { x: caretX, y: caretY };
  }

  function drawCaret(x, y) {
    tx.shadowColor = INK.p.glow;
    tx.shadowBlur = fs * 0.4;
    tx.fillStyle = '#C9A8FF';
    tx.fillRect(x, y + fs * 0.08, Math.max(charW * 0.9, 5), fs * 0.94);
    tx.shadowBlur = 0;
    tx.fillRect(x, y + fs * 0.08, Math.max(charW * 0.9, 5), fs * 0.94);
  }

  /* ---- WebGL: the tube -------------------------------------------------- */
  var VS = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec2 uCurve;',
    'uniform float uScan, uScanDepth, uTriad, uGrille, uChroma, uBar, uFlicker, uGrain, uVignette, uGain, uHalo;',
    'uniform vec3 uSheen, uRoom;',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'vec2 curve(vec2 uv){',
    '  uv = uv * 2.0 - 1.0;',
    '  vec2 o = uv.yx * uv.yx;',
    '  uv += uv * o * uCurve;',
    '  return uv * 0.5 + 0.5;',
    '}',
    'void main(){',
    '  vec2 fuv = gl_FragCoord.xy / uRes;',
    '  vec2 uv = curve(fuv);',
    '  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));',
    '  float inside = inb.x * inb.y;',
    '  vec2 ed = min(uv, 1.0 - uv);',
    '  inside *= smoothstep(0.0, 0.022, min(ed.x, ed.y));',
    '  vec2 dir = uv - 0.5;',
    '  float d2 = dot(dir, dir);',
    '  vec2 ao = dir * (0.0010 + 0.0075 * d2) * uChroma;',
    '  vec3 col;',
    '  col.r = texture2D(uTex, uv + ao).r;',
    '  col.g = texture2D(uTex, uv).g;',
    '  col.b = texture2D(uTex, uv - ao).b;',
    '  if (uHalo > 0.001){',
    '    float s = 0.0038;',
    '    vec3 wide = texture2D(uTex, uv + vec2(s, 0.0)).rgb + texture2D(uTex, uv + vec2(-s, 0.0)).rgb',
    '              + texture2D(uTex, uv + vec2(0.0, s)).rgb + texture2D(uTex, uv + vec2(0.0, -s)).rgb;',
    '    col += wide * (uHalo / 4.0);',
    '  }',
    '  float sl = sin(uv.y * 3.14159265 * uScan + uTime * 4.0);',
    '  col *= mix(1.0 - uScanDepth, 1.0, sl * sl);',
    '  float gx = gl_FragCoord.x * (6.2831853 / max(uTriad, 1.0));',
    '  vec3 grille = (1.0 - uGrille) + uGrille * cos(gx + vec3(0.0, 2.094, 4.188));',
    '  col *= mix(vec3(1.0), grille, step(0.001, uGrille));',
    '  col *= uGain;',
    '  float bar = fract(uv.y * 0.5 - uTime * 0.07);',
    '  bar = smoothstep(0.0, 0.05, bar) * smoothstep(0.18, 0.05, bar);',
    '  col += bar * uBar;',
    '  float sheen = smoothstep(0.55, 0.0, distance(uv, vec2(0.50, 0.15)));',
    '  col += sheen * 0.030 * uSheen;',
    '  float vig = smoothstep(0.98, 0.30, length((uv - 0.5) * vec2(1.05, 1.0)));',
    '  col *= mix(1.0 - uVignette, 1.0, vig);',
    '  col *= 1.0 - uFlicker * sin(uTime * 8.0);',
    '  col += (hash(fuv + fract(uTime * 0.37)) - 0.5) * uGrain;',
    '  float spill = smoothstep(0.85, 0.18, length(fuv - 0.5)) * 0.05;',
    '  vec3 room = uRoom + uSheen * spill * 0.42;',
    '  col = mix(room, col, inside);',
    '  col = max(col, uRoom * 0.34);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }

  var gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false });
  var prog = null, tex = null, uni = {}, ok = false;

  if (gl) {
    try {
      var vs = compile(gl, gl.VERTEX_SHADER, VS);
      var fsc = compile(gl, gl.FRAGMENT_SHADER, FS);
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fsc);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var pos = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      var names = ['uTex', 'uRes', 'uTime', 'uCurve', 'uScan', 'uScanDepth', 'uTriad', 'uGrille',
        'uChroma', 'uBar', 'uFlicker', 'uGrain', 'uVignette', 'uGain', 'uHalo', 'uSheen', 'uRoom'];
      for (var i = 0; i < names.length; i++) uni[names[i]] = gl.getUniformLocation(prog, names[i]);

      gl.uniform1i(uni.uTex, 0);
      gl.uniform2f(uni.uCurve, 0.10, 0.15);
      gl.uniform1f(uni.uScanDepth, 0.28);
      gl.uniform1f(uni.uGrille, 0.30);
      gl.uniform1f(uni.uChroma, 1.15);
      gl.uniform1f(uni.uBar, 0.038);
      gl.uniform1f(uni.uFlicker, 0.022);
      gl.uniform1f(uni.uGrain, 0.020);
      gl.uniform1f(uni.uVignette, 0.56);
      gl.uniform1f(uni.uGain, 1.46);
      gl.uniform1f(uni.uHalo, 0.10);
      gl.uniform3f(uni.uSheen, 0.72, 0.62, 1.0);
      gl.uniform3f(uni.uRoom, 0.016, 0.010, 0.032);
      ok = true;
    } catch (err) {
      ok = false;
    }
  }

  /* no WebGL: show the text canvas itself, so the message still lands */
  if (!ok) {
    cv.style.display = 'none';
    text.className = 'crt-flat';
    host.appendChild(text);
  }

  var W = 1, H = 1, dirty = true, started = 0, typed = 0, done = false, fade = 0, caret = { x: 0, y: 0 };

  function resize() {
    var r = host.getBoundingClientRect();
    var cw = Math.max(1, Math.round(r.width));
    var ch = Math.max(1, Math.round(r.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* the text plate is the thing that costs pixels per frame, so it is capped
       independently of the display surface */
    var tw = Math.max(600, Math.min(Math.round(cw * 1.2), 1500));
    var th = Math.max(1, Math.round(tw * ch / cw));
    if (text.width !== tw || text.height !== th) {
      text.width = tw; text.height = th;
      layout(tw, th);
      dirty = true;
    }
    if (!ok) {
      text.style.width = '100%';
      text.style.height = '100%';
      text.style.display = 'block';
    } else {
      var gw = Math.min(Math.round(cw * dpr), 1920);
      var gh = Math.max(1, Math.round(gw * ch / cw));
      if (cv.width !== gw || cv.height !== gh) {
        cv.width = gw; cv.height = gh;
      }
      gl.viewport(0, 0, gw, gh);
      gl.useProgram(prog);
      gl.uniform2f(uni.uRes, gw, gh);
      gl.uniform1f(uni.uScan, Math.max(140, Math.min(ch * 0.44, 900)));
      gl.uniform1f(uni.uTriad, Math.max(2, 3.2 * gw / cw));
    }
    W = cw; H = ch;
  }

  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  function loop(now) {
    if (!started) started = now;
    var t = (now - started) / 1000;

    if (!done) {
      typed += REDUCE ? TOTAL : 4.6;
      if (typed >= TOTAL) { typed = TOTAL; done = true; }
    } else if (fade < 1) {
      fade = Math.min(1, fade + 0.045);
    }

    var blink = Math.floor(t / 0.51) % 2 === 0;
    var reveal = REDUCE ? Infinity : Math.floor(typed);
    caret = drawScreen(reveal, REDUCE ? 1 : (done ? fade : 0));
    if (done && (REDUCE || blink)) drawCaret(caret.x, caret.y);

    if (ok) {
      upload();
      gl.useProgram(prog);
      gl.uniform1f(uni.uTime, REDUCE ? 2.4 : t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(loop);
  }

  /* the work's own name, straight out of content.json */
  fetch('content.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var item = d && d.works && d.works.items && d.works.items[idx - 1];
      if (item && item.title) {
        title = item.title;
        document.title = title + '｜Profunfis';
        var h1 = document.getElementById('crtTitle');
        if (h1) h1.textContent = title;
        var meta = document.querySelector('meta[name="description"]');
        if (meta && item.desc) meta.setAttribute('content', item.desc);
      }
    })
    .catch(function () {})
    .then(function () {
      resize();
      requestAnimationFrame(loop);
    });

  var q = 0;
  window.addEventListener('resize', function () {
    clearTimeout(q);
    q = setTimeout(resize, 140);
  }, { passive: true });

  /* the whole screen is the way back, the way a terminal takes any key */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('a')) return;
    location.href = 'works.html';
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Backspace' || e.key === ' ') {
      e.preventDefault();
      location.href = 'works.html';
    }
  });
})();
