/* ============================================================================
   face.js: the photo that comes alive.

   One beat between the hero and About. The portrait is Sai's real photo; every
   expression in it was rendered offline from that one photo by LivePortrait
   (a face reanimation model), upscaled 2x, and packed into one sprite sheet
   that holds only the part of the face that moves. The page draws the cutout
   once and lays the right face patch over it, so scrolling scrubs a real
   smile, then a real wink.

   The expression is one number, E, from 0 to 29: frames 0 to 15 are the smile
   arriving, 16 to 29 are the wink closing. Between two frames the next one is
   cross-faded in, so a slow scroll never steps. Blinks are separate frames and
   only fire while the face is at rest, neutral or fully smiling.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // From the asset build: canvas size, where the face patch sits on it, and
  // the order of the frames in the sheet (6 per row).
  var M = { w: 680, h: 868, patch: [135, 0, 354, 564], cols: 6 };
  var SMILE_END = 15, WINK_END = 29, BLINK_N = 30, BLINK_S = 33;

  var fig = document.getElementById('meet');
  if (!fig) return;
  var still = fig.querySelector('.meet__still');

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var win = function (q, a, b) { return smooth((q - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // Under reduced motion the face is simply smiling. No scrub, no blinks.
  if (reduce) { still.src = 'sai-smile.webp'; }

  var cv = null, cx = null, base = null, sheet = null, ready = false;
  function load() {
    if (reduce) return;
    var n = 2, done = function () { if (--n === 0) setup(); };
    base = new Image(); base.onload = done; base.src = still.currentSrc || still.src;
    sheet = new Image(); sheet.onload = done; sheet.src = 'sai-face.webp';
  }
  function setup() {
    cv = document.createElement('canvas');
    cv.width = M.w; cv.height = M.h;
    cv.className = 'meet__cv';
    cv.setAttribute('aria-hidden', 'true');
    cx = cv.getContext('2d');
    fig.appendChild(cv);
    ready = true;
    drawn = -1;
  }
  // The sheet is the heaviest file on the page, and the face is a scroll away,
  // so it waits for everything else.
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
    if (still.style.visibility !== 'hidden') still.style.visibility = 'hidden';
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

  // q: where the reader is inside the beat, 0 to 1. t: seconds, for the
  // blinks and the breathing. W, H: the stage. Returns a short state string
  // for the verification attribute.
  function update(q, t, phone, W, H) {
    var alpha = Math.min(win(q, -0.04, 0.1), 1 - win(q, 0.88, 0.99));
    if (alpha <= 0.001) { fig.style.opacity = '0'; fig.style.visibility = 'hidden'; return 'away'; }
    fig.style.visibility = 'visible';

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
    var sc = phone ? lerp(1, 0.94, m) : lerp(1, 0.94, m);
    var rise = (1 - win(q, -0.04, 0.12)) * h * 0.08 + win(q, 0.86, 1) * h * 0.05;
    var breathe = reduce ? 0 : Math.sin(t * 1.3) * 0.004;
    var tilt = reduce ? 0 : -1.6 * Math.sin(Math.PI * clamp((E - SMILE_END) / (WINK_END - SMILE_END), 0, 1) * 0.5);

    fig.style.width = w.toFixed(1) + 'px';
    fig.style.height = h.toFixed(1) + 'px';
    fig.style.opacity = alpha.toFixed(3);
    fig.style.transform = 'translate3d(' + (cxp - w / 2).toFixed(1) + 'px,' + (H - h + rise).toFixed(1) + 'px,0) rotate(' + tilt.toFixed(2) + 'deg) scale(' + (sc + breathe).toFixed(4) + ')';

    if (ready) {
      var restN = E < 0.02, restS = Math.abs(E - SMILE_END) < 0.02 && wink < 0.001;
      var b = reduce ? 0 : blinkLevel(t, restN || restS);
      paint(E, b);
    }
    return 'E' + E.toFixed(1);
  }

  window.FACE = { update: update };
})();
