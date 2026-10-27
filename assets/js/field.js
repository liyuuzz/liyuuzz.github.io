/* ==========================================================================
   field.js — the point field behind the about title.

   Fifteen thousand points on a cap of a sphere, drifting on two axes, drawn
   additively so overlaps accumulate into something that reads as depth rather
   than as dots. Raw WebGL: one buffer, one shader, no library, no build.

   The vertical fade is CSS, not shader — a mask on the canvas keeps the field
   from ever touching the top or bottom edge of the header.
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('fieldCanvas');
  if (!cv) return;

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var gl = cv.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) { cv.style.display = 'none'; return; }

  var COUNT = 15000;
  var RADIUS = 25;
  var CAM = [0, -5, 45];          /* the bowl centred on the view axis */
  var FOV = 60;

  var VS = [
    'attribute vec3 aPos;',
    'attribute float aRnd;',
    'uniform float uRY, uRZ, uSize, uProjX, uProjY;',
    'varying float vA;',
    'void main(){',
    '  vec3 p = aPos;',
    '  float cy = cos(uRY), sy = sin(uRY);',
    '  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);',
    '  float cz = cos(uRZ), sz = sin(uRZ);',
    '  p = vec3(p.x * cz - p.y * sz, p.x * sz + p.y * cz, p.z);',
    '  vec3 v = p - vec3(' + CAM[0].toFixed(1) + ', ' + CAM[1].toFixed(1) + ', ' + CAM[2].toFixed(1) + ');',
    '  float d = -v.z;',
    '  gl_Position = vec4(v.x * uProjX / d, v.y * uProjY / d, 0.0, 1.0);',
    '  gl_PointSize = clamp(uSize * (45.0 / d), 1.0, 7.0);',
    '  vA = (0.30 + 0.70 * aRnd) * smoothstep(78.0, 24.0, d);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'varying float vA;',
    'void main(){',
    '  vec2 q = gl_PointCoord - 0.5;',
    '  float r = length(q);',
    '  if (r > 0.5) discard;',
    '  float a = smoothstep(0.5, 0.04, r) * vA;',
    '  gl_FragColor = vec4(uColor * a, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }

  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  } catch (err) {
    cv.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  /* a seeded generator, so the field looks the same on every reload */
  var seed = 0x9E3779B9;
  function rnd() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  }

  var pos = new Float32Array(COUNT * 3);
  var rv = new Float32Array(COUNT);
  for (var i = 0; i < COUNT; i++) {
    var theta = rnd() * Math.PI * 2;
    var phi = Math.acos(rnd() * 0.8 + 0.2);
    pos[i * 3] = RADIUS * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = RADIUS * Math.cos(phi) - 20;
    pos[i * 3 + 2] = RADIUS * Math.sin(phi) * Math.sin(theta);
    rv[i] = rnd();
  }

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  var bufR = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufR);
  gl.bufferData(gl.ARRAY_BUFFER, rv, gl.STATIC_DRAW);
  var aRnd = gl.getAttribLocation(prog, 'aRnd');
  gl.enableVertexAttribArray(aRnd);
  gl.vertexAttribPointer(aRnd, 1, gl.FLOAT, false, 0, 0);

  var uRY = gl.getUniformLocation(prog, 'uRY');
  var uRZ = gl.getUniformLocation(prog, 'uRZ');
  var uSize = gl.getUniformLocation(prog, 'uSize');
  var uProjX = gl.getUniformLocation(prog, 'uProjX');
  var uProjY = gl.getUniformLocation(prog, 'uProjY');
  var uColor = gl.getUniformLocation(prog, 'uColor');

  gl.uniform3f(uColor, 0.72, 0.58, 1.0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  var W = 1, H = 1, ry = 0, rz = 0, running = false, raf = 0, last = 0;

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.round(r.width * dpr);
    H = Math.round(r.height * dpr);
    if (cv.width === W && cv.height === H) return;
    cv.width = W; cv.height = H;
    gl.viewport(0, 0, W, H);
    var aspect = W / Math.max(1, H);
    var f = 1 / Math.tan(FOV * Math.PI / 360);
    gl.useProgram(prog);
    gl.uniform1f(uProjY, f);
    gl.uniform1f(uProjX, f / aspect);
    gl.uniform1f(uSize, Math.max(1.4, Math.min(r.width, r.height) / 190) * dpr);
  }

  function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform1f(uRY, ry);
    gl.uniform1f(uRZ, rz);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min(64, now - last) / 1000 : 0.016;
    last = now;
    ry += dt * 0.05;
    rz += dt * 0.012;
    render();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || REDUCE) { render(); return; }
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  render();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) start(); else stop();
    }, { threshold: 0 }).observe(cv);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
  });

  var q = 0;
  window.addEventListener('resize', function () {
    clearTimeout(q);
    q = setTimeout(function () { resize(); render(); }, 160);
  }, { passive: true });
})();
