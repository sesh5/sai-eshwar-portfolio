/* ============================================================================
   face.js: the photo that comes alive, and turns.

   One beat between the hero and About. The portrait is Sai's real photo; every
   expression in it was rendered offline from that one photo by LivePortrait
   (a face reanimation model), upscaled 2x, and packed into one sprite sheet
   that holds only the part of the face that moves. A 2D canvas composites the
   current expression (base cutout + face patch), so scrolling scrubs a real
   smile, then a real wink.

   v4 adds depth. sai-depth.png is a depth map sculpted for this photo (nose
   nearest, ears and neck set back, shoulders falling away). WebGL turns the
   cutout into a relief mesh with that depth and rotates it in perspective,
   the head further than the shoulders, under a fixed light with a rim of the
   chapter's accent. He swings round to face you as the beat opens, sways a
   little at rest, follows the cursor, and can be dragged round. Without
   WebGL the flat canvas is shown exactly as before.

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
  var gl = null, glc = null, prog = null, texC = null, glDirty = true;

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

  // ---- WebGL: the photo as a relief you can turn ----------------------------
  // The cutout becomes a dense mesh whose height comes from the depth map: the
  // nose stands proud, the cheeks and ears curve away, the neck sits back. The
  // mesh is turned in real perspective, the head further than the shoulders
  // so the neck twists, and lit by a fixed light, so the side that turns away
  // falls into shade while a rim of the chapter's accent catches the edge.
  var STEP = 5;                          // one vertex every 5 source pixels
  var PAD = { x: 0.14, top: 0.08 };      // room around the figure to turn into
  var ZS = 0.30, PIVOT_D = 0.5;          // relief depth, and the depth it turns about
  var HEAD_Y = 0.5 - 300 / 868;          // the head's centre, in model units (height 1)
  var CAM = 2.4;                         // camera distance, in figure heights
  var VS = [
    'attribute vec3 aP;attribute vec2 aT;attribute vec3 aN;attribute float aW;',
    'uniform vec2 uRot;uniform vec4 uView;uniform float uPY;',
    'varying vec2 vT;varying vec3 vN;',
    'void main(){',
    '  float k=mix(.42,1.,aW);float a=uRot.x*k,b=uRot.y*k;',
    '  vec3 p=aP-vec3(0.,uPY,0.);',
    '  float ca=cos(a),sa=sin(a),cb=cos(b),sb=sin(b);',
    '  p=vec3(ca*p.x+sa*p.z,p.y,-sa*p.x+ca*p.z);',
    '  vec3 n=vec3(ca*aN.x+sa*aN.z,aN.y,-sa*aN.x+ca*aN.z);',
    '  p=vec3(p.x,cb*p.y-sb*p.z,sb*p.y+cb*p.z);',
    '  n=vec3(n.x,cb*n.y-sb*n.z,sb*n.y+cb*n.z);',
    '  p.y+=uPY;',
    '  float f=uView.w/(uView.w-p.z);',
    '  gl_Position=vec4(p.x*f/uView.x,(p.y*f-uView.z)/uView.y,-p.z*.5,1.);',
    '  vT=aT;vN=n;',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float;',
    'uniform sampler2D uC;uniform vec3 uRim;varying vec2 vT;varying vec3 vN;',
    'void main(){',
    '  vec4 c=texture2D(uC,vT);',
    '  if(c.a<.03)discard;',
    '  vec3 n=normalize(vN);',
    '  float dif=max(dot(n,normalize(vec3(-.45,.5,.85))),0.);',
    '  float shade=.66+.45*dif;',
    '  float rim=pow(1.-clamp(n.z,0.,1.),2.2);',
    '  gl_FragColor=vec4(c.rgb*shade+uRim*rim*.55*c.a,c.a);',
    '}'
  ].join('\n');

  var uRot = null, uRim = null, uView = null, nIdx = 0, rimHex = '';
  function initGL() {
    try {
      glc = document.createElement('canvas');
      glc.className = 'meet__gl';
      glc.setAttribute('aria-hidden', 'true');
      gl = glc.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
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

      // Read the depth map once, then build the relief on the CPU, so no
      // vertex-texture support is needed.
      var dc = document.createElement('canvas');
      dc.width = depth.naturalWidth; dc.height = depth.naturalHeight;
      var dx = dc.getContext('2d'); dx.drawImage(depth, 0, 0);
      var dd = dx.getImageData(0, 0, dc.width, dc.height).data, DW = dc.width, DH = dc.height;
      function dAt(px, py) {   // bilinear, in source-image pixels
        var u = clamp(px / M.w * (DW - 1), 0, DW - 1), v = clamp(py / M.h * (DH - 1), 0, DH - 1);
        var x0 = u | 0, y0 = v | 0, x1 = Math.min(x0 + 1, DW - 1), y1 = Math.min(y0 + 1, DH - 1), fx = u - x0, fy = v - y0;
        var a = dd[(y0 * DW + x0) * 4], b = dd[(y0 * DW + x1) * 4], c = dd[(y1 * DW + x0) * 4], d = dd[(y1 * DW + x1) * 4];
        return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) / 255;
      }
      var NX = Math.floor(M.w / STEP) + 1, NY = Math.floor(M.h / STEP) + 1, AR = M.w / M.h;
      var P = new Float32Array(NX * NY * 3), TT = new Float32Array(NX * NY * 2), NN = new Float32Array(NX * NY * 3), WW = new Float32Array(NX * NY);
      var e = STEP, sx = e / M.h * 2, k;
      for (var j = 0; j < NY; j++) {
        for (var i = 0; i < NX; i++) {
          k = j * NX + i;
          var px = Math.min(i * STEP, M.w), py = Math.min(j * STEP, M.h);
          P[k * 3] = (px / M.w - 0.5) * AR;
          P[k * 3 + 1] = 0.5 - py / M.h;
          P[k * 3 + 2] = (dAt(px, py) - PIVOT_D) * ZS;
          TT[k * 2] = px / M.w; TT[k * 2 + 1] = py / M.h;
          // normal from the relief's slope, in model units (y points up)
          var gx = (dAt(px + e, py) - dAt(px - e, py)) * ZS / sx;
          var gy = (dAt(px, py - e) - dAt(px, py + e)) * ZS / sx;
          var L = Math.sqrt(gx * gx + gy * gy + 1);
          NN[k * 3] = -gx / L; NN[k * 3 + 1] = -gy / L; NN[k * 3 + 2] = 1 / L;
          // the head turns fully, the shoulders less, the neck in between
          WW[k] = 1 - smooth((py - 520) / 160);
        }
      }
      var I = new Uint16Array((NX - 1) * (NY - 1) * 6), n = 0;
      for (j = 0; j < NY - 1; j++) for (i = 0; i < NX - 1; i++) {
        k = j * NX + i;
        I[n++] = k; I[n++] = k + 1; I[n++] = k + NX;
        I[n++] = k + 1; I[n++] = k + NX + 1; I[n++] = k + NX;
      }
      nIdx = n;
      function attr(name, data, size) {
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      attr('aP', P, 3); attr('aT', TT, 2); attr('aN', NN, 3); attr('aW', WW, 1);
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);

      texC = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texC);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.uniform1i(gl.getUniformLocation(prog, 'uC'), 0);
      uRot = gl.getUniformLocation(prog, 'uRot');
      uRim = gl.getUniformLocation(prog, 'uRim');
      uView = gl.getUniformLocation(prog, 'uView');
      gl.uniform1f(gl.getUniformLocation(prog, 'uPY'), HEAD_Y);
      // the visible window, padded so a turned head never clips
      var halfW = AR / 2 * (1 + 2 * PAD.x), halfH = 0.5 * (1 + PAD.top), cy = 0.5 * PAD.top;
      gl.uniform4f(uView, halfW, halfH, cy, CAM);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.clearColor(0, 0, 0, 0);
      glc.style.left = (-PAD.x * 100).toFixed(2) + '%';
      glc.style.width = ((1 + 2 * PAD.x) * 100).toFixed(2) + '%';
      glc.style.top = (-PAD.top * 100).toFixed(2) + '%';
      glc.style.height = ((1 + PAD.top) * 100).toFixed(2) + '%';
      fig.appendChild(glc);
      return true;
    } catch (err) {
      gl = null; if (glc && glc.parentNode) glc.parentNode.removeChild(glc); glc = null;
      return false;
    }
  }

  function rimColour() {
    var a = getComputedStyle(document.documentElement).getPropertyValue('--a').trim();
    if (a === rimHex || !/^#[0-9a-f]{6}$/i.test(a)) return;
    rimHex = a;
    gl.uniform3f(uRim, parseInt(a.substr(1, 2), 16) / 255, parseInt(a.substr(3, 2), 16) / 255, parseInt(a.substr(5, 2), 16) / 255);
    glDirty = true;
  }

  var glW = 0, glH = 0, glYaw = 99, glPitch = 99, MAX_YAW = 0.5, MAX_PITCH = 0.2;
  function glDraw(w, h, yaw, pitch) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(Math.min(w * (1 + 2 * PAD.x) * dpr, 2000)), bh = Math.round(bw * (h * (1 + PAD.top)) / (w * (1 + 2 * PAD.x)));
    if (bw !== glW || bh !== glH) { glW = glc.width = bw; glH = glc.height = bh; gl.viewport(0, 0, bw, bh); glDirty = true; }
    rimColour();
    if (!glDirty && Math.abs(yaw - glYaw) < 0.0006 && Math.abs(pitch - glPitch) < 0.0006) return;
    if (glDirty) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texC);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      glDirty = false;
    }
    glYaw = yaw; glPitch = pitch;
    gl.uniform2f(uRot, yaw * MAX_YAW, pitch * MAX_PITCH);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
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
      drag.yaw = 0.88 * Math.tanh((drag.y0 + (e.clientX - drag.x) / 150) / 0.88);   // rubber-band past ~25 degrees
      drag.pitch = 0.6 * Math.tanh((drag.p0 + (e.clientY - drag.yy) / 220) / 0.6);
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
    var arrive = 1 - win(q, -0.04, 0.18);
    var settled = 1 - arrive;
    // a slow idle sway, so the volume shows even before anyone touches him
    var sway = Math.sin(t * 0.55) * 0.16 + Math.sin(t * 0.23 + 1.3) * 0.08;
    var tYaw = 1.05 * arrive + sway * settled, tPitch = Math.sin(t * 0.41) * 0.12 * settled;
    if (finePointer) { tYaw += follow.x * 0.75 * settled; tPitch += follow.y * 0.5 * settled; }
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
      if (gl) glDraw(w, h, yaw, pitch);
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
