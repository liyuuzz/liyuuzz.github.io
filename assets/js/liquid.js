/* ==========================================================================
   liquid.js — the primary button.
   A scalar field V is painted through a soft plateau; the plateau is
   evaluated once per spectral wavelength at a slightly different height, so
   its lower edge fringes warm and its upper edge fringes cool. Fringe width
   falls out as dispersion / |grad V|, which is why the same shader gives
   razor-thin rainbow lines where the field is pinched and broad washes where
   it is not.

   Single pass on purpose: the reference component softened the metal through
   a five-target blur chain, which is a lot of plumbing for one button. Five
   taps inside the shader get most of the way there.
   ========================================================================== */
(function () {
  'use strict';

  var VS = '#version 300 es\n' +
    'layout(location=0) in vec2 position;\n' +
    'void main(){ gl_Position = vec4(position, 0.0, 1.0); }';

  var FS = [
    '#version 300 es',
    'precision highp float;',
    'out vec4 o;',
    'uniform vec2  uRes;',
    'uniform vec2  uC;',
    'uniform vec2  uHalf;',
    'uniform float uT;',
    'uniform float uHover;',
    'uniform float uPress;',
    'uniform vec3  uPtr;',
    'uniform vec3  uRip;',
    '',
    '#define PI 3.14159265',
    '',
    'float hash21(vec2 p){',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float vn(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1.0,0.0));',
    '  float c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y) * 2.0 - 1.0;',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 1.0, n = 0.0;',
    '  for(int i=0;i<3;i++){ s += a*vn(p); n += a; p = p*2.03 + 11.7; a *= 0.5; }',
    '  return s/n;',
    '}',
    'float wig(float x, float t, float seed){',
    '  return vn(vec2(x, t*0.15 + seed)) * 0.60',
    '       + vn(vec2(x*2.07 + 4.0, t*0.105 + seed)) * 0.27',
    '       + vn(vec2(x*4.30 - 7.0, t*0.080 + seed)) * 0.13;',
    '}',
    'float valley(vec2 p, float t){ return wig(p.x*0.50, t, 0.0) * 0.55; }',
    'float dens(vec2 p, float t){ return 2.95 * exp(2.20 * wig(p.x*0.32 + 9.0, t, 2.7)); }',
    '',
    /* V = (y - valley(x)) * density(x): level sets are vertical translates of
       one valley curve, so the ribbons stay laminar and near-parallel, and the
       density swing crowds them into fringes at one end and opens a broad wash
       at the other */
    'float surface(vec2 p, float t){',
    '  float V = (p.y - valley(p,t)) * dens(p,t);',
    '  V += 0.12 * fbm(p*vec2(1.28, 2.72) + vec2(t*0.05, -t*0.03));',
    '  return V - 0.05;',
    '}',
    'float tone(float v){',
    '  float u = fract(v);',
    '  float e = 0.05, W = 0.15;',
    '  return smoothstep(0.5-W-e, 0.5-W, u) * (1.0 - smoothstep(0.5+W, 0.5+W+e, u));',
    '}',
    'vec3 spec(float t){ return clamp(vec3(1.5) - abs(4.0*t - vec3(3.0,2.0,1.0)), 0.0, 1.0); }',
    '',
    'float ripple(vec2 p, float t){',
    '  if(uRip.z < -50.0) return 0.0;',
    '  float age = t - uRip.z;',
    '  if(age < 0.0 || age > 2.6) return 0.0;',
    '  vec2 rp = p - uRip.xy;',
    '  float facet = 1.0 + 0.18*cos(6.0*atan(rp.y, rp.x) + age*2.1);',
    '  float x = (length(rp) - age*1.85*facet) / 0.20;',
    '  return exp(-pow(abs(x) + 1e-4, 1.15)) * exp(-age*1.35);',
    '}',
    '',
    'vec3 metal(vec2 p, float t){',
    '  float V = surface(p, t) + ripple(p, t) * 1.35;',
    '  float mid = 1.0 - pow(0.5, 1.5);',
    '  vec3 col = vec3(0.0), wsum = vec3(0.0);',
    '  for(int i=0;i<9;i++){',
    '    float k = float(i)/8.0;',
    '    vec3 w = spec(k);',
    '    float off = ((1.0 - pow(1.0-k, 1.5)) - mid) * 0.24;',
    '    col += w * tone(V + off);',
    '    wsum += w;',
    '  }',
    '  col /= wsum;',
    '  float lit = smoothstep(-0.26, 0.10, p.y - valley(p, t));',
    '  lit *= mix(1.0, lit, 0.55);',
    '  return pow(col, vec3(1.18)) * 2.15 * lit;',
    '}',
    '',
    'float sdPill(vec2 p, vec2 b, float r){',
    '  vec2 q = abs(p) - b + r;',
    '  return min(max(q.x,q.y), 0.0) + length(max(q,0.0)) - r;',
    '}',
    'float pb(float u, float w){ u = fract(u); float x = min(u, 1.0-u); return exp(-(x*x)/(w*w)); }',
    '',
    'void main(){',
    '  vec2 d = gl_FragCoord.xy - uC;',
    '  float sd = sdPill(d, uHalf, uHalf.y);',
    '  float pill = 1.0 - smoothstep(-1.0, 1.0, sd);',
    '  float S = uHalf.y * 2.0;',
    '  vec2 p = vec2(d.x, -d.y) / S;',
    '',
    '  vec2 q = p;',
    '  if(uPtr.z > 0.001){',
    '    float dd = length(p - uPtr.xy) / 0.55;',
    '    float w = exp(-dd*dd) * uPtr.z;',
    '    q += normalize(p - uPtr.xy + vec2(1e-5)) * w * 0.30;',
    '  }',
    '',
    '  float r = 0.032;',
    '  vec3 col = metal(q, uT) * 0.36;',
    '  col += (metal(q + vec2(r,0.0), uT) + metal(q - vec2(r,0.0), uT)',
    '        + metal(q + vec2(0.0,r), uT) + metal(q - vec2(0.0,r), uT)) * 0.16;',
    '',
    '  float veil = 1.0 - smoothstep(0.42, 0.92, abs(d.y)/uHalf.y);',
    '  col *= mix(1.0, 0.52, veil);',
    '',
    '  float ang = atan(d.y, d.x) / (2.0*PI) + 0.5;',
    '  float hot = 0.20',
    '            + 0.62 * pb(ang - uT*0.070, 0.075)',
    '            + 0.44 * pb(ang + uT*0.044 + 0.41, 0.135)',
    '            + 0.30 * pb(ang - uT*0.024 + 0.73, 0.200);',
    '  hot *= 1.0 + uPress*0.85 + ripple(p, uT)*0.9;',
    '  float band = 1.0 - smoothstep(0.0, 1.9, abs(sd));',
    '  vec3 rim = vec3(',
    '    band * (1.0 - smoothstep(0.0, 1.9, abs(sd + 0.8))) * hot,',
    '    band * hot,',
    '    band * (1.0 - smoothstep(0.0, 1.9, abs(sd - 0.8))) * hot',
    '  ) * 1.05;',
    '',
    '  vec3 rgb = (col + rim) * pill * (0.46 + 0.54 * uHover);',
    '  float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0);',
    '  o = vec4(min(rgb, vec3(1.0)), a);',
    '}'
  ].join('\n');

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'shader');
    }
    return s;
  }

  function mount(host) {
    var canvas = host.querySelector('canvas');
    if (!canvas) return;

    var gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true, antialias: false, premultipliedAlpha: true,
        depth: false, stencil: false, powerPreference: 'high-performance'
      });
    } catch (e) { gl = null; }

    if (!gl) { host.setAttribute('data-fx', 'off'); return; }

    var prog, u = {};
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog) || 'link');
      }
      gl.useProgram(prog);
      ['uRes', 'uC', 'uHalf', 'uT', 'uHover', 'uPress', 'uPtr', 'uRip'].forEach(function (n) {
        u[n] = gl.getUniformLocation(prog, n);
      });
    } catch (err) {
      if (window.console) console.warn('[liquid]', err.message);
      host.setAttribute('data-fx', 'off');
      return;
    }

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    var W = 0, H = 0, DPR = 1;
    var clock = 0, hover = 0, hoverTarget = 0, press = 0, pressTarget = 0;
    var ptr = { x: 0, y: 0, amt: 0, tx: 0, ty: 0 };
    var rip = { x: 0, y: 0, t: -999 };
    var needResize = true;
    var visible = true, running = false, lastDraw = 0, last = 0;

    function resize() {
      var r = host.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(2, Math.round(r.width * DPR));
      H = Math.max(2, Math.round(r.height * DPR));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      needResize = false;
    }

    /* pointer position in pill-height units from the centre, +y down */
    function local(e) {
      var b = host.getBoundingClientRect();
      var s = b.height || 1;
      return [(e.clientX - (b.left + b.width / 2)) / s,
              (e.clientY - (b.top + b.height / 2)) / s];
    }

    host.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      var q = local(e);
      ptr.x = ptr.tx = q[0];
      ptr.y = ptr.ty = q[1];
      hoverTarget = 1;
    });
    host.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') hoverTarget = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!hoverTarget && !pressTarget) return;
      var q = local(e);
      ptr.tx = q[0]; ptr.ty = q[1];
    }, { passive: true });
    host.addEventListener('pointerdown', function (e) {
      var q = local(e);
      ptr.tx = ptr.x = q[0];
      ptr.ty = ptr.y = q[1];
      pressTarget = 1;
      rip.x = q[0]; rip.y = q[1]; rip.t = clock;
    });
    window.addEventListener('pointerup', function () { pressTarget = 0; });
    window.addEventListener('pointercancel', function () { pressTarget = 0; });
    host.addEventListener('focus', function () {
      if (host.matches(':focus-visible')) hoverTarget = 1;
    });
    host.addEventListener('blur', function () { hoverTarget = 0; });
    host.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        pressTarget = 1;
        rip.x = 0; rip.y = 0; rip.t = clock;
      }
    });
    host.addEventListener('keyup', function () { pressTarget = 0; });

    new ResizeObserver(function () { needResize = true; }).observe(host);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) start();
      }, { threshold: 0.01 }).observe(host);
    }

    function frame(now) {
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      if (!REDUCED) clock += dt;

      var k = hoverTarget > hover ? 1 - Math.pow(0.0012, dt) : 1 - Math.pow(0.00012, dt);
      hover += (hoverTarget - hover) * k;
      var pk = pressTarget > press ? 1 - Math.pow(1e-9, dt) : 1 - Math.pow(0.004, dt);
      press += (pressTarget - press) * pk;

      /* the well trails the cursor, which is what makes the bands bulge like
         a lens instead of sliding a blob over the metal */
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.pow(0.02, dt));
      ptr.y += (ptr.ty - ptr.y) * (1 - Math.pow(0.02, dt));
      var want = (hoverTarget || pressTarget) ? 1 : 0;
      ptr.amt += (want - ptr.amt) * (1 - Math.pow(0.004, dt));

      var idle = !hoverTarget && !pressTarget && hover < 0.01 && press < 0.01;
      if (idle && now - lastDraw < 1000 / 26) { requestAnimationFrame(frame); return; }
      lastDraw = now;

      if (needResize) resize();

      gl.useProgram(prog);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform2f(u.uC, W / 2, H / 2);
      gl.uniform2f(u.uHalf, W / 2, H / 2);
      gl.uniform1f(u.uT, clock);
      gl.uniform1f(u.uHover, Math.min(1, hover));
      gl.uniform1f(u.uPress, press);
      gl.uniform3f(u.uPtr, ptr.x, ptr.y, ptr.amt);
      gl.uniform3f(u.uRip, rip.x, rip.y, rip.t);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      requestAnimationFrame(frame);
    }

    function start() {
      if (running || !visible) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }

    resize();
    host.setAttribute('data-fx', 'on');
    start();
  }

  var hosts = document.querySelectorAll('[data-liquid]');
  for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
})();
