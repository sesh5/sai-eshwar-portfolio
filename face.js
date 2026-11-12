/* ============================================================================
   face.js: the photo that comes alive, and turns.

   One beat between the hero and About. The portrait is Sai's real photo; every
   expression in it was rendered offline from that one photo by LivePortrait
   (a face reanimation model), upscaled 2x, and packed into one sprite sheet
   that holds only the part of the face that moves. A 2D canvas composites the
   current expression (base cutout + face patch), so scrolling scrubs a real
   smile, then a real wink.

   v4 adds depth. sai-depth.png is a depth map sculpted for this photo (nose
   nearest, ears and neck set back, shoulders falling away). A small WebGL
   shader uses it to shift near parts of the picture further than far parts
   when the head turns, and to light the side that faces the turn, so the
   flat cutout reads as a head with volume. The turn comes from three places:
   he swings round to face you as the beat opens, his gaze follows the cursor,
   and you can drag him round yourself. If WebGL is missing, the flat canvas
   is shown exactly as before.

   The expression is one number, E, from 0 to 29: frames 0 to 15 are the smile
   arriving, 16 to 29 are the wink closing. Between two frames the next one is
   cross-faded in, so a slow scroll never steps. Blinks are separate frames and
   only fire while the face is at rest, neutral or fully smiling.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // From the asset build: canvas size, where the face patch sits on it, and
  // the order of the frames in the sheet (6 per row).
  var M = { w: 680, h: 868, patch: [135, 0, 354, 564], cols: 6 };
  var SMILE_END = 15, WINK_END = 29, BLINK_N = 30, BLINK_S = 33;

  var fig = document.getElementById('meet');
  if (!fig) return;
  var still = fig.querySelector('.meet__still');
  still.setAttribute('draggable', 'false');
  var hint = document.querySelector('.meet__hint');

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var win = function (q, a, b) { return smooth((q - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // Under reduced motion the face is simply smiling. No scrub, no blinks, no turn.
  if (reduce) { still.src = 'sai-smile.webp'; }

  var cv = null, cx = null, base = null, sheet = null, depth = null, ready = false;
  var gl = null, glc = null, prog = null, uRot = null, uLight = null, texC = null, texD = null, glDirty = true;

  function load() {
    if (reduce) return;
    var n = 3, done = function () { if (--n === 0) setup(); };
    base = new Image(); base.onload = done; base.src = still.currentSrc || still.src;
    sheet = new Image(); sheet.onload = done; sheet.src = 'sai-face.webp';
    depth = new Image(); depth.onload = done; depth.onerror = function () { depth = null; done(); }; depth.src = 'sai-depth.png';
  }

  function setup() {
    cv = document.createElement('canvas');
    cv.width = M.w; cv.height = M.h;
    cv.className = 'meet__cv';
    cv.setAttribute('aria-hidden', 'true');
    cx = cv.getContext('2d');
    if (!(depth && initGL())) fig.appendChild(cv);   // flat fallback
    ready = true;
    drawn = -1;
  }

  // ---- WebGL: one quad, the expression canvas as colour, the depth map ----
  var VS = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform sampler2D uC,uD;uniform vec2 uRot;uniform vec3 uLight;varying vec2 v;',
    'void main(){',
    // Parallax by fixed-point iteration: find the source point whose depth,
    // shifted by the turn, lands on this pixel. 0.42 is the pivot depth.
    '  vec2 p=v;',
    '  for(int i=0;i<8;i++){float d=texture2D(uD,p).r;p=mix(p,v-uRot*(d-.42),.7);}',
    '  vec4 c=texture2D(uC,p);',
    '  float e=1./240.;',
    '  float dx=texture2D(uD,p+vec2(e,0.)).r-texture2D(uD,p-vec2(e,0.)).r;',
    '  float dy=texture2D(uD,p+vec2(0.,e)).r-texture2D(uD,p-vec2(0.,e)).r;',
    '  vec3 n=normalize(vec3(-dx*7.,dy*7.,1.));',
    '  float lit=dot(n,normalize(uLight));',
    '  float shade=.88+.2*lit;',
    '  gl_FragColor=vec4(c.rgb*shade,c.a);',
    '}'
  ].join('\n');

  function initGL() {
    try {
      glc = document.createElement('canvas');
      glc.className = 'meet__cv meet__gl';
      glc.setAttribute('aria-hidden', 'true');
      gl = glc.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) return false;
      function sh(type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      function tex(unit) {
        var t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return t;
      }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      texD = tex(1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depth);
      texC = tex(0);
      gl.uniform1i(gl.getUniformLocation(prog, 'uC'), 0);
      gl.uniform1i(gl.getUniformLocation(prog, 'uD'), 1);
      uRot = gl.getUniformLocation(prog, 'uRot');
      uLight = gl.getUniformLocation(prog, 'uLight');
      gl.clearColor(0, 0, 0, 0);
      fig.appendChild(glc);
      return true;
    } catch (err) {
      gl = null; if (glc && glc.parentNode) glc.parentNode.removeChild(glc); glc = null;
      return false;
    }
  }

  var glW = 0, glH = 0, glYaw = 99, glPitch = 99;
  function glDraw(w, h, yaw, pitch) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(Math.min(w * dpr, M.w * 2)), bh = Math.round(bw * M.h / M.w);
    if (bw !== glW || bh !== glH) { glW = glc.width = bw; glH = glc.height = bh; gl.viewport(0, 0, bw, bh); glDirty = true; }
    if (!glDirty && Math.abs(yaw - glYaw) < 0.0008 && Math.abs(pitch - glPitch) < 0.0008) return;
    if (glDirty) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texC);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      glDirty = false;
    }
    glYaw = yaw; glPitch = pitch;
    gl.uniform2f(uRot, yaw * 0.034, pitch * 0.026);
    // The light stays put while the head turns, so the side swinging toward
    // it brightens and the other side falls into shade.
    gl.uniform3f(uLight, -0.35 - yaw * 0.9, 0.45 + pitch * 0.6, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (still.style.visibility !== 'hidden') still.style.visibility = 'hidden';
  }

  // The heaviest files on the page wait for everything else; the face is a
  // scroll away.
  if (document.readyState === 'complete') load(); else addEventListener('load', load);

  function patch(i, alpha) {
    var p = M.patch, c = i % M.cols, r = (i / M.cols) | 0;
    cx.globalAlpha = alpha;
    cx.drawImage(sheet, c * p[2], r * p[3], p[2], p[3], p[0], p[1], p[2], p[3]);
  }

  var drawn = -1;
  function paint(E, blink) {
    var key = blink ? 100 + blink : Math.round(E * 40) / 40;
    if (key === drawn) return;
    drawn = key;
    cx.globalCompositeOperation = 'source-over';
    cx.globalAlpha = 1;
    cx.clearRect(0, 0, M.w, M.h);
    cx.drawImage(base, 0, 0);
    // source-atop: the face patch only paints where the cutout already is,
    // so the base alone decides the silhouette and the hair edges.
    cx.globalCompositeOperation = 'source-atop';
    if (blink) {
      patch((E < 1 ? BLINK_N : BLINK_S) + blink - 1, 1);
    } else {
      var i = Math.floor(E), f = E - i;
      patch(i, 1);
      if (f > 0.02 && i < WINK_END) patch(i + 1, f);
    }
    glDirty = true;
    if (!gl && still.style.visibility !== 'hidden') still.style.visibility = 'hidden';
  }

  // Blinks: a natural gap of 2.5 to 6 seconds, about 170ms each, closing
  // faster than it opens. Only at rest, so a blink never fights the scroll.
  var nextBlink = 0, blinkAt = -1;
  function blinkLevel(t, rest) {
    if (!rest) { blinkAt = -1; if (nextBlink < t + 0.8) nextBlink = t + 0.8 + Math.random() * 1.5; return 0; }
    if (blinkAt < 0 && t >= nextBlink) blinkAt = t;
    if (blinkAt < 0) return 0;
    var k = (t - blinkAt) / 0.17;
    if (k >= 1) { blinkAt = -1; nextBlink = t + 2.5 + Math.random() * 3.5; return 0; }
    var closed = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
    return clamp(Math.round(closed * 3), 0, 3);
  }

  // ---- the turn: scroll, cursor and drag, through one spring --------------
  // yaw > 0 turns his face toward the viewer's right; pitch > 0 tips it down.
  var yaw = 0, pitch = 0, vYaw = 0, vPitch = 0;
  var follow = { x: 0, y: 0 }, drag = null, touched = false, live = false;

  addEventListener('pointermove', function (e) {
    if (drag && e.pointerId === drag.id) {
      drag.yaw = clamp(drag.y0 + (e.clientX - drag.x) / 170, -1.15, 1.15);
      drag.pitch = clamp(drag.p0 + (e.clientY - drag.yy) / 260, -0.7, 0.7);
      if (!touched && Math.abs(e.clientX - drag.x) > 8) touched = true;
      return;
    }
    if (!live || !finePointer || e.pointerType !== 'mouse') return;
    var r = fig.getBoundingClientRect();
    follow.x = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5), -1, 1);
    follow.y = clamp((e.clientY - (r.top + r.height * 0.32)) / (innerHeight * 0.6), -1, 1);
  }, { passive: true });

  fig.addEventListener('pointerdown', function (e) {
    if (reduce || !live || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, yy: e.clientY, y0: yaw, p0: pitch, yaw: yaw, pitch: pitch };
    try { fig.setPointerCapture(e.pointerId); } catch (err) {}
    fig.classList.add('is-dragging');
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null; fig.classList.remove('is-dragging');
  }
  fig.addEventListener('pointerup', endDrag);
  fig.addEventListener('pointercancel', endDrag);
  fig.addEventListener('lostpointercapture', endDrag);

  function stepSpring(tYaw, tPitch) {
    if (drag) { yaw = drag.yaw; pitch = drag.pitch; vYaw = vPitch = 0; return; }
    // a slightly underdamped spring: let go and he settles back with a small overshoot
    vYaw = (vYaw + (tYaw - yaw) * 0.09) * 0.8;
    vPitch = (vPitch + (tPitch - pitch) * 0.09) * 0.8;
    yaw += vYaw; pitch += vPitch;
  }

  // q: where the reader is inside the beat, 0 to 1. t: seconds, for the
  // blinks and the breathing. W, H: the stage. Returns a short state string
  // for the verification attribute.
  function update(q, t, phone, W, H) {
    var alpha = Math.min(win(q, -0.04, 0.1), 1 - win(q, 0.88, 0.99));
    if (alpha <= 0.001) {
      live = false; drag = null;
      fig.style.opacity = '0'; fig.style.visibility = 'hidden';
      if (hint) hint.style.opacity = '0';
      return 'away';
    }
    fig.style.visibility = 'visible';
    live = !reduce && q > 0.08 && q < 0.86;

    // the smile arrives, holds, then one eye closes and opens again
    var E = win(q, 0.14, 0.4) * SMILE_END;
    var wink = q < 0.62 ? win(q, 0.46, 0.6) : 1 - win(q, 0.66, 0.76);
    if (E >= SMILE_END - 0.001) E = SMILE_END + wink * (WINK_END - SMILE_END);
    if (reduce) { E = SMILE_END; wink = 0; }

    // Size: bottom-anchored, as if he were standing in the frame.
    var h, w;
    if (phone) { w = Math.min(W * 0.92, 420); h = w * M.h / M.w; h = Math.min(h, H * 0.6); w = h * M.w / M.h; }
    else { h = Math.min(H * 0.84, 820); w = h * M.w / M.h; }

    // Then he steps aside for the narrator's line (desktop), or makes a
    // little room under it (phone).
    var m = reduce ? 1 : win(q, 0.7, 0.84);
    var cxp = phone ? W / 2 : lerp(W * 0.5, W * 0.72, m);
    var sc = lerp(1, 0.94, m);
    var rise = (1 - win(q, -0.04, 0.12)) * h * 0.08 + win(q, 0.86, 1) * h * 0.05;
    var breathe = reduce ? 0 : Math.sin(t * 1.3) * 0.004;
    var tilt = reduce ? 0 : -1.6 * Math.sin(Math.PI * clamp((E - SMILE_END) / (WINK_END - SMILE_END), 0, 1) * 0.5);

    // Where he wants to look: turned away as he arrives, round to face you,
    // toward the cursor while he is on stage, and toward the narrator's line
    // as he steps aside for it.
    var arrive = 1 - win(q, -0.04, 0.16);
    var tYaw = 0.95 * arrive, tPitch = 0;
    if (finePointer) { tYaw += follow.x * 0.6 * (1 - arrive); tPitch += follow.y * 0.35 * (1 - arrive); }
    if (!phone) tYaw = lerp(tYaw, -0.55, m);
    if (reduce) { tYaw = 0; tPitch = 0; }
    stepSpring(tYaw, tPitch);

    fig.style.width = w.toFixed(1) + 'px';
    fig.style.height = h.toFixed(1) + 'px';
    fig.style.opacity = alpha.toFixed(3);
    fig.style.transform = 'translate3d(' + (cxp - w / 2).toFixed(1) + 'px,' + (H - h + rise).toFixed(1) + 'px,0) rotate(' + tilt.toFixed(2) + 'deg) scale(' + (sc + breathe).toFixed(4) + ')';

    if (ready) {
      var restN = E < 0.02, restS = Math.abs(E - SMILE_END) < 0.02 && wink < 0.001;
      var b = reduce ? 0 : blinkLevel(t, restN || restS);
      paint(E, b);
      if (gl) {
        glDraw(w, h, yaw, pitch);
        // the silhouette foreshortens a little too, so the edges agree with the shading
        glc.style.transform = 'perspective(1500px) rotateY(' + (yaw * 7).toFixed(2) + 'deg) rotateX(' + (-pitch * 4).toFixed(2) + 'deg)';
      }
    }

    // The invitation to turn him: only once he has settled, and never again
    // after the first drag.
    if (hint) {
      var hv = gl && !touched ? win(q, 0.18, 0.26) * (1 - win(q, 0.6, 0.68)) : 0;
      hint.style.opacity = hv.toFixed(3);
    }
    return 'E' + E.toFixed(1) + ' Y' + yaw.toFixed(2);
  }

  window.FACE = { update: update };
})();
