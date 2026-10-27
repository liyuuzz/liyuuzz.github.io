/* ==========================================================================
   space.js — the room the page is read in.

   Everything else on this site is flat: canvases painted onto rectangles. This
   is the one thing with depth. A corridor of points runs down the -Z axis, a
   gate stands across it, a floor of dots waits at the bottom; the camera walks
   the corridor as you scroll.

   The camera is the whole idea. Scroll position is mapped onto a continuous
   chapter number (0 … 4), damped once, and then read by two Catmull-Rom curves
   — one for the eye, one for what it is looking at. That is what makes the
   movement read as one continuous walk instead of four cuts, and it is the
   single technique taken from the reference this site was measured against.

   Nothing here is required for the page to work. No WebGL2, no canvas, and the
   text is unchanged.
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('spaceCanvas');
  if (!cv) return;

  var gl = null;
  try {
    gl = cv.getContext('webgl2', {
      alpha: true, antialias: false, premultipliedAlpha: true,
      depth: false, stencil: false, powerPreference: 'high-performance'
    });
  } catch (e) { gl = null; }
  if (!gl) return degrade(cv, 'WebGL2');

  /* no room, no air: the page's own grounds close back up so nothing is left
     looking like a failed texture */
  function degrade(canvas, why) {
    document.documentElement.classList.add('no-space');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (window.console && console.warn) console.warn('[space] ' + why);
  }

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0 || 1), 0, 1); return t * t * (3 - 2 * t); }

  /* ====================================================================== *
   * matrix — column major, the two matrices a point cloud needs
   * ====================================================================== */
  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }

  function lookAt(out, eye, center, up) {
    var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    var zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;

    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    var xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;

    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;

    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mul(out, a, b) {
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                         a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  /* ====================================================================== *
   * curves — one Catmull-Rom, used twice
   * ====================================================================== */
  /* uniform Catmull-Rom: cheap, and with waypoints this far apart the
     centripetal correction is not visible */
  function curveAt(pts, u, out) {
    var n = pts.length - 1;
    u = clamp(u, 0, n);
    var i = Math.min(Math.floor(u), n - 1);
    var f = u - i;
    var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    var f2 = f * f, f3 = f2 * f;
    for (var k = 0; k < 3; k++) {
      out[k] = 0.5 * ((2 * p1[k]) +
        (-p0[k] + p2[k]) * f +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
    }
    return out;
  }

  /* ====================================================================== *
   * the walk — five chapters, expressed as where the eye is and where it looks
   * ====================================================================== */
  var CAM_P = [
    [ 0.00,  0.00,    0.0],   /* 0  the first screen                      */
    [ 0.55,  1.10,  -26.0],   /* 1  the ribbon: rising, toward the gate    */
    [-1.10,  0.30,  -58.0],   /* 2  the works: past it, drifting left      */
    [ 0.90, -1.20,  -94.0],   /* 3  the notes: down and right              */
    [ 0.00, -3.60, -132.0]    /* 4  the close: settling toward the floor   */
  ];
  var CAM_T = [
    [ 0.00,  0.00,  -24.0],
    [ 0.10,  0.30,  -62.0],
    [-0.20, -0.60,  -96.0],
    [ 0.30,  0.40, -128.0],
    [ 0.00, -9.00, -164.0]
  ];
  var FOV = 46;

  var RIG = {
    prog: 0,          /* where the page is, in chapters */
    smooth: 0,        /* the same value, damped */
    intro: 0,         /* 0 → 1 opening dolly */
    eye: [0, 0, 0],
    at: [0, 0, -1]
  };

  /* ====================================================================== *
   * the point cloud — one buffer, three populations
   * ====================================================================== */
  var data = [];   /* [x,y,z, r,g,b, size] per point */

  function push(x, y, z, col, size) {
    data.push(x, y, z, col[0], col[1], col[2], size);
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* the corridor: a tube of dust around the -Z axis, hollow in the middle so
     the type at the centre of the screen never has to fight it */
  function buildCorridor(r) {
    var N = 15000;
    var z0 = 8, z1 = -215;
    for (var i = 0; i < N; i++) {
      var t = r();
      var z = lerp(z0, z1, Math.pow(t, 1.15));

      /* the bore is clear at the top and grows with depth */
      var inner = 5.5 + (-z) * 0.045;
      var outer = inner + 9 + 14 * r();
      var ang = r() * TAU;
      var rad = lerp(inner, outer, Math.pow(r(), 0.62));

      var x = Math.cos(ang) * rad;
      var y = Math.sin(ang) * rad * 0.86;

      /* near points are pale, far points sink into the ground */
      var k = clamp((-z) / 200, 0, 1);
      var white = Math.pow(r(), 3) * 0.9;
      var col = [
        lerp(0.79, 0.28, k) + white * 0.2,
        lerp(0.66, 0.20, k) + white * 0.2,
        lerp(0.99, 0.42, k) + white * 0.25
      ];
      push(x, y, z, col, 0.055 + r() * 0.085);
    }
  }

  /* the gate: a vertical ring the camera flies through, so the walk has one
     event in it rather than a uniform drift */
  function buildGate(r) {
    var R = 7.4, Z = -40, N = 2600;
    for (var i = 0; i < N; i++) {
      var a = r() * TAU;
      /* two bands: a hard rim and a soft halo */
      var band = r() < 0.62 ? 0 : 1;
      var rad = band ? R + (r() - 0.5) * 2.6 : R * (1 + (r() - 0.5) * 0.055);
      var bright = band ? 0.26 : 0.86;
      var col = [0.82 * bright + 0.18, 0.70 * bright + 0.16, 1.0 * bright + 0.10];
      push(Math.cos(a) * rad, Math.sin(a) * rad, Z + (r() - 0.5) * 0.5, col,
        band ? 0.04 + r() * 0.05 : 0.07 + r() * 0.08);
    }
  }

  /* the floor: what the walk is descending toward */
  function buildFloor(r) {
    var N = 4200;
    for (var i = 0; i < N; i++) {
      var x = (r() - 0.5) * 90;
      var z = -96 - r() * 130;
      var y = -10.5 + (r() - 0.5) * 0.35;
      var d = Math.hypot(x, (z + 160) * 0.55);
      var k = clamp(1 - d / 95, 0, 1);
      push(x, y, z, [0.42 + k * 0.42, 0.32 + k * 0.38, 0.62 + k * 0.38], 0.05 + r() * 0.06);
    }
  }

  /* ambient: a sparse shell so the void has a scale */
  function buildDust(r) {
    for (var i = 0; i < 2400; i++) {
      var z = 20 - r() * 240;
      var ang = r() * TAU;
      var rad = 6 + Math.pow(r(), 0.5) * 46;
      push(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.8, z,
        [0.30 + r() * 0.25, 0.26 + r() * 0.2, 0.48 + r() * 0.3],
        0.03 + r() * 0.05);
    }
  }

  (function () {
    var r = rng(0x5EA1);
    buildCorridor(r);
    buildGate(r);
    buildFloor(r);
    buildDust(r);
  })();

  var COUNT = data.length / 7;
  var buf = new Float32Array(data);
  var stride = 7 * 4;
  data = null;

  /* ====================================================================== *
   * shaders
   * ====================================================================== */
  var VS = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aCol;',
    'layout(location=2) in float aSize;',
    'uniform mat4  uVP;',
    'uniform vec3  uEye;',
    'uniform float uPixel;',   // pixels per world unit at distance 1
    'uniform float uTime;',
    'out vec3  vCol;',
    'out float vA;',
    'void main(){',
    '  gl_Position = uVP * vec4(aPos, 1.0);',
    '  float d = distance(aPos, uEye);',
    '  gl_PointSize = clamp(aSize * uPixel / max(d, 1.2), 1.0, 22.0);',
    '  float near = smoothstep(1.4, 5.0, d);',
    '  float far  = 1.0 - smoothstep(120.0, 235.0, d);',
    '  float tw   = 0.74 + 0.26 * sin(uTime * 1.6 + aSize * 90.0 + aPos.z * 0.05);',
    '  vA = near * far * tw;',
    '  vCol = aCol;',
    '}'
  ].join('\n');

  var FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec3  vCol;',
    'in float vA;',
    'uniform float uDim;',
    'out vec4 o;',
    'void main(){',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float r = dot(d, d);',
    '  float a = smoothstep(0.26, 0.02, r);',
    '  a *= vA * uDim;',
    '  if (a < 0.004) discard;',
    '  o = vec4(vCol * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'shader');
    }
    return s;
  }

  var prog, U = {};
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['uVP', 'uEye', 'uPixel', 'uTime', 'uDim'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });
  } catch (err) {
    return degrade(cv, err.message);
  }

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* ====================================================================== *
   * viewport
   * ====================================================================== */
  var W = 1, H = 1, DPR = 1, P = new Float32Array(16), V = new Float32Array(16), VP = new Float32Array(16);
  var backoff = 0;

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(w * DPR));
    H = Math.max(2, Math.round(h * DPR));
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    gl.viewport(0, 0, W, H);
    /* a tall frame sees less of the width; step back along the view axis
       instead of letting the corridor close in on the sides */
    backoff = clamp((1.55 - w / h) / 0.95, 0, 1) * 11;
    draw(true);
  }

  /* ====================================================================== *
   * scroll → chapter, the one thing everything else reads
   * ====================================================================== */
  var SECS = [].slice.call(document.querySelectorAll('[data-cam]'));
  var anchors = [], maxScroll = 1;

  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    anchors = SECS.map(function (el, i) {
      if (i === 0) return 0;
      if (i === SECS.length - 1) return maxScroll;
      var r = el.getBoundingClientRect();
      var top = r.top + window.pageYOffset;
      return clamp(top + r.height * 0.5 - window.innerHeight * 0.5, 0, maxScroll);
    });
    for (var i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
  }

  function progressFor(y) {
    if (!anchors.length) return 0;
    if (y <= anchors[0]) return 0;
    for (var i = 0; i < anchors.length - 1; i++) {
      if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i] || 1);
    }
    return anchors.length - 1;
  }

  /* ====================================================================== *
   * frame
   * ====================================================================== */
  var clock = 0, last = 0, tPrev = 0, running = false, raf = 0, lastDraw = 0;
  var NCH = CAM_P.length - 1;

  function draw(force) {
    var now = performance.now();
    /* when the camera has settled there is still a twinkle to keep alive, but
       it does not need sixty frames a second */
    var moving = Math.abs(RIG.prog - RIG.smooth) > 0.0004 || RIG.intro < 0.999;
    if (!force && !moving && now - lastDraw < 55) return;
    lastDraw = now;

    curveAt(CAM_P, RIG.smooth, RIG.eye);
    curveAt(CAM_T, RIG.smooth, RIG.at);

    /* the opening dolly: a long lens easing in from further back */
    var io = 1 - RIG.intro;
    var eye = [
      RIG.eye[0],
      RIG.eye[1] + io * 1.6,
      RIG.eye[2] + io * 6.4
    ];
    /* the walk is 160 units long, so a narrow frame has to step back too */
    var dir = [RIG.at[0] - eye[0], RIG.at[1] - eye[1], RIG.at[2] - eye[2]];
    var dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    eye[0] -= dir[0] / dl * backoff;
    eye[1] -= dir[1] / dl * backoff;
    eye[2] -= dir[2] / dl * backoff;

    var fov = (FOV + io * 9) * Math.PI / 180;
    perspective(P, fov, W / H, 0.4, 320);
    lookAt(V, eye, RIG.at, [0, 1, 0]);
    mul(VP, P, V);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uPixel, (H * 0.5) / Math.tan(fov * 0.5));
    gl.uniform1f(U.uTime, clock);
    /* the space steps back as the page's own content takes over: at the top
       of the page it is the subject, by the works it is the ground */
    gl.uniform1f(U.uDim, 0.96 - 0.34 * smoothstep(0.6, 2.4, RIG.smooth));
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }

  function frame(now) {
    if (!running) return;
    var dt = tPrev ? Math.min((now - tPrev) / 1000, 0.05) : 0.016;
    tPrev = now;
    clock += dt;

    if (RIG.intro < 1) RIG.intro = Math.min(1, RIG.intro + dt / 1.6);

    /* the damping. 5.2 puts ~95% of the travel behind the wheel in 570ms —
       slow enough to smooth a trackpad, fast enough that the type stays
       attached to the hand. */
    var d = RIG.prog - RIG.smooth;
    if (Math.abs(d) > 0.00005) RIG.smooth += d * (1 - Math.exp(-5.2 * dt));
    else RIG.smooth = RIG.prog;

    draw(false);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || REDUCE) return;
    running = true;
    tPrev = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ====================================================================== *
   * wiring
   * ====================================================================== */
  var target = 0;
  function onScroll() {
    target = window.pageYOffset || document.documentElement.scrollTop || 0;
    RIG.prog = progressFor(target);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); onScroll(); resize(); }, 140);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  function boot() {
    measure();
    onScroll();
    /* the first frame is already the closing frame of the tune-in */
    RIG.smooth = REDUCE ? RIG.prog : Math.max(0, RIG.prog);

    if (REDUCE) {
      RIG.intro = 1;
      draw(true);
      window.addEventListener('scroll', function () { onScroll(); RIG.smooth = RIG.prog; draw(true); }, { passive: true });
      return;
    }
    resize();
    start();
  }

  /* the chapter list depends on the copy being in place, and the sections are
     measured after fonts land */
  var ready = window.__contentReady || Promise.resolve();
  ready.then(function () {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot);
    else boot();
  }, boot);

  window.__space = {
    count: function () { return COUNT; },
    rig: RIG,
    anchors: function () { return anchors.slice(); }
  };
})();
