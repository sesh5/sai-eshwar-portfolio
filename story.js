/* ============================================================================
   story.js: the split stage.

   One pinned act holds the whole featured story. On one side of a moving seam
   is friction: a field of dots drifting with no order. On the other side is
   what got shipped: the same dots, locked into a formation built from that
   project's real figures. Scroll moves the seam, and every dot that the seam
   passes crosses from friction into order.

   The scrollcraft engine is left untouched. This file builds the timeline,
   writes every cue window onto the markup, mounts the engine, and draws the
   field on its own canvas from the act's scroll position.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phoneMQ = matchMedia('(max-width: 760px)');

  var act = document.getElementById('story');
  var bar = document.getElementById('bar');
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d');

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---- the timeline, in viewport-heights of pinned travel ------------------
  // The peak owns the most room, and the quiet beat in front of it is authored
  // silence: the seam floods back to full friction and holds, with no copy.
  var SEGS = [
    { id: 'hero',  len: 0.7,  form: 'grid' },
    { id: 'p1',    len: 1.4,  form: 'payees' },
    { id: 'p2',    len: 1.4,  form: 'retention' },
    { id: 'p3',    len: 1.4,  form: 'seats' },
    { id: 'p4',    len: 1.4,  form: 'dishes' },
    { id: 'quiet', len: 0.35, form: 'dishes' },
    { id: 'peak',  len: 1.85, form: 'window' }
  ];
  var T = 0;
  SEGS.forEach(function (s) { s.s = T; T += s.len; s.e = T; });
  act.setAttribute('data-sc-span', (T + 1).toFixed(2));

  function seg(id) { for (var i = 0; i < SEGS.length; i++) if (SEGS[i].id === id) return SEGS[i]; }
  function segAt(u) { for (var i = 0; i < SEGS.length; i++) if (u < SEGS[i].e) return SEGS[i]; return SEGS[SEGS.length - 1]; }

  // A cue window written in travel units: in from a, full at `full`, leaving
  // from `fade`, gone at b. The engine takes fractions of the act.
  function win(a, full, fade, b) {
    var w = Math.max(b - a, 0.001);
    return [a / T, b / T, (full - a) / w, (b - fade) / w].map(function (n) {
      return clamp(n, 0, 1).toFixed(4);
    }).join(' ');
  }

  // ---- write the cue windows, then mount the engine ------------------------
  (function () {
    var h = seg('hero');
    // Greet: fully present on the first frame, so the recruiter's screen is
    // never an empty stage waiting for a fade.
    stage.querySelector('[data-cue="hero"]').setAttribute('data-sc-cue', win(0, 0, 0.42, 0.66));
    ['p1', 'p2', 'p3', 'p4'].forEach(function (id) {
      var s = seg(id), L = s.len, part = stage.querySelector('[data-part="' + id + '"]');
      part.querySelector('[data-cue="fr"]').setAttribute('data-sc-cue',
        win(s.s + 0.03 * L, s.s + 0.15 * L, s.s + 0.47 * L, s.s + 0.57 * L));
      part.querySelector('[data-cue="sh"]').setAttribute('data-sc-cue',
        win(s.s + 0.60 * L, s.s + 0.72 * L, s.e, s.e + 0.06));
    });
    var pk = seg('peak');
    // The close of the act holds to the end: rOut 0, so it is still fully lit
    // at p = 1 and the stage slides away with its ask on it.
    stage.querySelector('[data-cue="peak"]').setAttribute('data-sc-cue',
      win(pk.s + 0.42 * pk.len, pk.s + 0.56 * pk.len, T, T));
    void h;
  })();

  var engine = ScrollCraft.mount(document.body);

  // ---- the seam -------------------------------------------------------------
  // D is where the seam sits, as a fraction of the stage: of its width on a
  // desktop, of its height on a phone. Friction owns [0, D], shipped [D, 1].
  var G = { DS: 0.68, DE: 0.36, Dh: 0.5 };

  function seamAt(u) {
    var s = segAt(u), q = clamp((u - s.s) / s.len, 0, 1);
    // Every hold still creeps a little, so no stretch of scroll is dead.
    if (s.id === 'hero') return G.Dh + (phone ? 0.012 : 0.03) * smooth(q);
    if (/^p\d$/.test(s.id)) {
      var from = s.id === 'p1' ? G.Dh + (phone ? 0.012 : 0.03) : G.DE;
      var hiD = G.DS + 0.02, loD = G.DS - 0.02;
      if (q < 0.12) return lerp(from, hiD, smooth(q / 0.12));
      if (q < 0.40) return lerp(hiD, loD, (q - 0.12) / 0.28);
      if (q < 0.75) return lerp(loD, G.DE, smooth((q - 0.40) / 0.35));
      return G.DE;
    }
    if (s.id === 'quiet') return q < 0.6 ? lerp(G.DE, 1, smooth(q / 0.6)) : 1;
    return q < 0.55 ? lerp(1, 0, smooth(q / 0.55)) : 0;
  }

  // ---- seeded randomness, so every visit draws the same figures ------------
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- formations: points in a unit box, plus the box's aspect -------------
  // Every count here is a real figure from the page, except the dishes, which
  // are captioned on the page as illustrative.
  var N = 1800;
  var FORMS = {};

  // 1,000 payees in one client configuration.
  FORMS.payees = (function () {
    var pts = [], cols = 40, rows = 25;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) pts.push({ x: c / (cols - 1), y: r / (rows - 1), lit: 0, row: r });
    return { pts: pts, aspect: (cols - 1) / (rows - 1), size: 3.4, sweep: rows };
  })();

  // 10,000 installs, one dot per 100: 30 came back on day 7.
  FORMS.retention = (function () {
    var pts = [];
    for (var r = 0; r < 10; r++) for (var c = 0; c < 10; c++) pts.push({ x: c / 9, y: r / 9, lit: r * 10 + c < 30 ? 1 : 0 });
    return { pts: pts, aspect: 1, size: 9 };
  })();

  // 234 seats as an assembly chart. The first 163, read from the left, are the
  // seats that changed party. Grouped the way a parliament chart groups them.
  FORMS.seats = (function () {
    var total = 234, rows = 9, radii = [], sum = 0, pts = [];
    for (var i = 0; i < rows; i++) { var r = 0.42 + 0.58 * i / (rows - 1); radii.push(r); sum += r; }
    var counts = radii.map(function (r) { return Math.round(total * r / sum); });
    var diff = total - counts.reduce(function (a, b) { return a + b; }, 0);
    counts[rows - 1] += diff;
    radii.forEach(function (r, i) {
      for (var j = 0; j < counts[i]; j++) {
        var th = Math.PI - Math.PI * (j + 0.5) / counts[i];
        pts.push({ x: (1 + r * Math.cos(th)) / 2, y: 1 - r * Math.sin(th), th: th });
      }
    });
    pts.sort(function (a, b) { return b.th - a.th; });
    pts.forEach(function (p, k) { p.lit = k < 163 ? 1 : 0; });
    return { pts: pts, aspect: 2, size: 6.5 };
  })();

  // Illustrative dishes, plotted by calories and protein. Lit when a dish is
  // under 500 kcal, at least 25 g protein, and not fried.
  FORMS.dishes = (function () {
    var R = rng(20260926), pts = [];
    for (var i = 0; i < 320; i++) {
      var cal = 140 + Math.pow(R(), 0.8) * 960;
      var pro = clamp(cal * 0.028 + (R() - 0.35) * 30, 3, 62);
      // A small cluster of genuinely lean, high-protein dishes: the answer.
      if (R() < 0.12) { cal = 220 + R() * 260; pro = 26 + R() * 20; }
      var fried = R() < 0.3;
      pts.push({ x: (cal - 100) / 1100, y: 1 - pro / 65, lit: cal < 500 && pro >= 25 && !fried ? 1 : 0 });
    }
    return { pts: pts, aspect: 1.5, size: 4.2, axes: { calX: (500 - 100) / 1100, proY: 1 - 25 / 65 } };
  })();

  // The availability window: December 2026 to December 2027, thirteen
  // months, built out of every dot on the page.
  var MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function windowForm(phone) {
    var cw = phone ? 3 : 4, per = Math.floor(N / 13 / cw) * cw, ch = per / cw, gap = phone ? 3.2 : 4.5;
    var colW = cw - 1, Wd = 13 * colW + 12 * gap, Hd = ch - 1, pts = [], centers = [];
    for (var m = 0; m < 13; m++) {
      var x0 = m * (colW + gap);
      centers.push((x0 + colW / 2) / Wd);
      for (var k = 0; k < per; k++) {
        var c = k % cw, r = Math.floor(k / cw);
        pts.push({ x: (x0 + c) / Wd, y: (Hd - r) / Hd, lit: 1 });
      }
    }
    return { pts: pts, aspect: Wd / Hd, size: phone ? 2.4 : 3.2, centers: centers };
  }

  // ---- particles ------------------------------------------------------------
  var px = new Float32Array(N), py = new Float32Array(N);
  var cx = new Float32Array(N), cy = new Float32Array(N);
  var al = new Float32Array(N), ord = new Uint8Array(N), seedR = new Float32Array(N);
  var R0 = rng(7);
  for (var i = 0; i < N; i++) seedR[i] = R0();

  // Pixel geometry, rebuilt on every layout.
  var W = 0, H = 0, dpr = 1, phone = false, placed = {}, meta = {};
  var U = 0, Dcur = 0.5, t0 = performance.now(), started = false;

  function box(region, aspect) {
    var rw = region.x1 - region.x0, rh = region.y1 - region.y0, w, h;
    if (rw / rh > aspect) { h = rh; w = h * aspect; } else { w = rw; h = w / aspect; }
    return { x: region.x0 + (rw - w) / 2, y: region.y0 + (rh - h) / 2, w: w, h: h };
  }

  function place(form, region) {
    var b = box(region, form.aspect);
    var out = form.pts.map(function (p) { return { x: b.x + p.x * b.w, y: b.y + p.y * b.h, lit: p.lit, row: p.row }; });
    return { pts: out, box: b, form: form };
  }

  function rel(el) {
    // Position inside the stage, ignoring the engine's small entrance rise.
    return { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth };
  }

  function gutter() { return Math.max(20, Math.min(W * 0.05, 88)); }

  function layout() {
    phone = phoneMQ.matches;
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    stage.classList.toggle('is-phone', phone);

    var g = gutter();
    G.DS = phone ? 0.64 : 0.68;
    G.DE = phone ? 0.40 : 0.36;

    // The hero's seam runs between the two halves of the headline.
    if (phone) {
      var a = stage.querySelector('.hero__a').getBoundingClientRect();
      var bb = stage.querySelector('.hero__b').getBoundingClientRect();
      var st = stage.getBoundingClientRect();
      G.Dh = clamp(((a.bottom + bb.top) / 2 - st.top) / H, 0.2, 0.8);
    } else {
      G.Dh = 0.5;
    }

    // Hero: a calm grid over the whole shipped side.
    (function () {
      var sp = phone ? 26 : 34, pts = [];
      var x0 = phone ? g : W * G.Dh + 18, y0 = phone ? H * G.Dh + 14 : 70;
      for (var y = y0; y < H - 10; y += sp) for (var x = x0; x < W - 8; x += sp) pts.push({ x: x, y: y, lit: 0 });
      placed.grid = { pts: pts.slice(0, N - 600), form: { size: phone ? 1.6 : 1.8, dim: 0.32 } };
    })();

    // Projects: the formation sits in the shipped side's final extent, above
    // the shipped copy, so the two never overlap.
    ['p1', 'p2', 'p3', 'p4'].forEach(function (id) {
      var part = stage.querySelector('[data-part="' + id + '"]');
      var sh = rel(part.querySelector('.sh'));
      var region = phone
        ? { x0: g, x1: W - g, y0: H * G.DE + 26, y1: sh.top - 18 }
        : { x0: W * (G.DE + 0.05), x1: W - g, y0: Math.max(96, H * 0.15), y1: sh.top - 30 };
      var name = part.getAttribute('data-form');
      placed[name] = place(FORMS[name], region);
    });

    // Peak: the window spans the stage under the ask.
    (function () {
      var copy = rel(stage.querySelector('.peak__copy'));
      var wf = windowForm(phone);
      var maxW = Math.min(W - 2 * g, 1120);
      var cxm = W / 2;
      var region = { x0: cxm - maxW / 2, x1: cxm + maxW / 2, y0: copy.bottom + (phone ? 30 : 44), y1: H - (phone ? 54 : 66) };
      placed.window = place(wf, region);
    })();

    if (!started) {
      // Pour every dot out of the seam on first paint.
      for (var i = 0; i < N; i++) {
        var along = seedR[i] * (phone ? W : H);
        if (phone) { px[i] = along; py[i] = H * G.Dh; } else { px[i] = W * G.Dh; py[i] = along; }
        cx[i] = px[i]; cy[i] = py[i]; al[i] = 0;
        respawn(i, true);
        if (reduce) { px[i] = cx[i]; py[i] = cy[i]; }
      }
      started = true;
    }
    read();
    draw();
  }

  // ---- scroll ---------------------------------------------------------------
  function read() {
    var r = act.getBoundingClientRect();
    var travel = Math.max(act.offsetHeight - innerHeight, 1);
    U = clamp(-r.top / travel, 0, 1) * T;
    var s = segAt(U);
    var D = seamAt(U);
    stage.classList.toggle('in-hero', s.id === 'hero');
    bar.classList.toggle('bar--solid', r.bottom < 70);
    // Tell the verification harness what the stage is actually showing: the
    // seam and the beat. The resolved close is an authored hold.
    stage.setAttribute('data-sc-verify-state', s.id + ':' + D.toFixed(2));
    var q = (U - s.s) / s.len;
    if (s.id === 'peak' && q > 0.6) stage.setAttribute('data-sc-verify-hold', 'true');
    else stage.removeAttribute('data-sc-verify-hold');
    return D;
  }

  // ---- friction: a flow field, confined to its own side of the seam --------
  function flow(x, y, t) {
    return Math.sin(x * 0.0061 + t * 0.37) * 2.1 + Math.cos(y * 0.0073 - t * 0.29) * 1.7 + Math.sin((x - y) * 0.0042 + t * 0.21) * 1.3;
  }

  function respawn(i, keep) {
    var Dpx = (phone ? H : W) * Dcur;
    var lo = phone ? 64 : 10, hi = Math.max(lo + 2, Dpx - 10);
    var a = lo + Math.random() * (hi - lo), o = Math.random() * (phone ? W : H);
    if (phone) { cx[i] = o; cy[i] = a; } else { cx[i] = a; cy[i] = o; }
    if (!keep) { px[i] = cx[i]; py[i] = cy[i]; al[i] = 0; }
  }

  var rects = [];
  function quietRects() {
    // Dots dim wherever copy is on screen, so type always sits on a quiet
    // patch. The mask is part of the canvas, so the contrast pass measures it.
    rects.length = 0;
    var els = stage.querySelectorAll('[data-sc-cue]');
    var st = stage.getBoundingClientRect();
    for (var k = 0; k < els.length; k++) {
      var o = parseFloat(els[k].style.opacity || '0');
      if (o < 0.04) continue;
      var r = els[k].getBoundingClientRect();
      rects.push([r.left - st.left - 18, r.top - st.top - 14, r.right - st.left + 18, r.bottom - st.top + 14]);
    }
    rects.push([0, 0, W, 60]);
  }
  function quiet(x, y) {
    for (var k = 0; k < rects.length; k++) {
      var r = rects[k];
      if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return k === rects.length - 1 ? 0.35 : 0.12;
    }
    return 1;
  }

  var C_FR = '#8f8f88', C_INK = '#ecebe6', C_LIT = '#43e29b';
  var FR_GROUND = '#0a0b0d', SH_GROUND = '#0b110e';

  function draw() {
    var t = (performance.now() - t0) / 1000;
    var Dt = read();
    Dcur = reduce ? Dt : lerp(Dcur, Dt, 0.22);
    stage.style.setProperty('--d', Dcur.toFixed(4));
    var size = phone ? H : W, Dpx = size * Dcur;

    var s = segAt(U), P = placed[s.form];
    var F = P.form, pts = P.pts, n = Math.min(pts.length, N);
    quietRects();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = FR_GROUND;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = SH_GROUND;
    if (phone) ctx.fillRect(0, Dpx, W, H - Dpx); else ctx.fillRect(Dpx, 0, W - Dpx, H);

    // Axes for the dish plot, drawn in as the seam passes over them.
    if (s.form === 'dishes' && P.box) {
      var b = P.box, shown = clamp(((phone ? b.y + b.h : b.x + b.w) - Dpx) / (phone ? b.h : b.w), 0, 1);
      if (shown > 0.02) {
        ctx.globalAlpha = 0.55 * shown;
        ctx.strokeStyle = '#6d6e68'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 6); ctx.lineTo(b.x, b.y + b.h + 6); ctx.lineTo(b.x + b.w + 6, b.y + b.h + 6);
        ctx.stroke();
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        var ax = b.x + F.axes.calX * b.w, ay = b.y + F.axes.proY * b.h;
        ctx.moveTo(ax, b.y); ctx.lineTo(ax, b.y + b.h + 6);
        ctx.moveTo(b.x, ay); ctx.lineTo(b.x + b.w, ay);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#a3a39b';
        ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
        ctx.fillText('500 kcal', ax + 6, b.y + b.h - 4);
        ctx.fillText('25 g protein', b.x + 6, ay - 7);
        ctx.fillText('calories →', b.x + b.w - 78, b.y + b.h + 22);
        ctx.save(); ctx.translate(b.x - 10, b.y + 70); ctx.rotate(-Math.PI / 2);
        ctx.fillText('protein →', 0, 0); ctx.restore();
      }
    }

    // Month labels under the availability window.
    if (s.form === 'window' && P.box) {
      var bw = P.box, cs = P.form.centers;
      ctx.font = (phone ? '500 10px' : '500 12px') + ' "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (var m = 0; m < 13; m++) {
        var lx = bw.x + cs[m] * bw.w;
        var la = phone ? clamp((bw.y + bw.h - Dpx) / 30, 0, 1) : clamp((lx - Dpx) / 40, 0, 1);
        if (la <= 0) continue;
        ctx.globalAlpha = 0.85 * la;
        ctx.fillStyle = '#a3a39b';
        ctx.fillText(MONTHS[m], lx, bw.y + bw.h + (phone ? 18 : 24));
        if (m === 0 || m === 1 || m === 12) {
          ctx.fillStyle = '#6d6e68';
          ctx.fillText(m === 1 ? '2027' : m === 0 ? '2026' : '2027', lx, bw.y + bw.h + (phone ? 31 : 41));
        }
      }
      ctx.textAlign = 'start';
    }

    var sweepRow = F.sweep ? Math.floor(t * 3) % F.sweep : -1;
    var spd = phone ? 0.5 : 0.7, lo = phone ? 64 : 10, hi = Dpx - 10;
    var dsz = F.size || 2, fsz = phone ? 1.6 : 1.9;

    // Three passes so the fill colour changes three times a frame, not 1,200.
    for (var pass = 0; pass < 3; pass++) {
      ctx.fillStyle = pass === 0 ? C_FR : pass === 1 ? C_INK : C_LIT;
      for (var i = 0; i < N; i++) {
        var tgt = i < n ? pts[i] : null;
        var isOrd = !!tgt && (phone ? tgt.y : tgt.x) > Dpx;
        if (pass === 0) {
          // Update once, on the first pass.
          if (isOrd) {
            ord[i] = 1;
          } else {
            if (ord[i]) { cx[i] = px[i]; cy[i] = py[i]; ord[i] = 0; }
            if (!reduce) {
              var ang = flow(cx[i], cy[i], t) * 1.1 + seedR[i] * 0.6;
              cx[i] += Math.cos(ang) * spd; cy[i] += Math.sin(ang) * spd;
            }
            var a = phone ? cy[i] : cx[i], o = phone ? cx[i] : cy[i], lim = phone ? W : H;
            // Out of bounds: nudge back, and now and then lift the dot out and
            // drop it somewhere fresh, so friction never packs into a wall.
            var out = false;
            if (hi > lo + 4) {
              if (a > hi) { a -= (a - hi) * 0.3 + 0.8; out = a > hi + 24 || Math.random() < 0.06; }
              if (a < lo) { a = lo + (lo - a) * 0.5 + 0.5; out = out || Math.random() < 0.06; }
            }
            if (phone) { cy[i] = a; } else { cx[i] = a; }
            if (out || o < 2 || o > lim - 2) respawn(i, false);
          }
          var tx = isOrd ? tgt.x : cx[i], ty = isOrd ? tgt.y : cy[i];
          var k = reduce ? 1 : isOrd ? 0.085 : 0.16;
          px[i] += (tx - px[i]) * k; py[i] += (ty - py[i]) * k;
          var want = isOrd ? (tgt.lit || tgt.row === sweepRow ? 1 : (F.dim || 0.55)) : (hi > lo + 4 ? 0.6 : 0);
          al[i] = reduce ? want : al[i] + (want - al[i]) * 0.14;
        }
        var cls = !isOrd ? 0 : (tgt.lit || tgt.row === sweepRow) ? 2 : 1;
        if (cls !== pass) continue;
        var alpha = al[i] * quiet(px[i], py[i]);
        if (alpha < 0.01) continue;
        ctx.globalAlpha = alpha;
        var z = cls === 0 ? fsz : dsz;
        ctx.fillRect(px[i] - z / 2, py[i] - z / 2, z, z);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- loop: only while the stage can be seen ------------------------------
  var running = false;
  function visible() {
    var r = act.getBoundingClientRect();
    return r.bottom > -40 && r.top < innerHeight + 40 && !document.hidden;
  }
  function loop() {
    if (!visible()) { running = false; return; }
    draw();
    requestAnimationFrame(loop);
  }
  function kick() {
    if (reduce) { draw(); return; }
    if (!running && visible()) { running = true; requestAnimationFrame(loop); }
  }
  addEventListener('scroll', function () { if (!running) read(); kick(); }, { passive: true });
  document.addEventListener('visibilitychange', kick);

  var lastW = 0;
  function relayout() {
    // A phone's URL bar changes the height on every scroll; only a real width
    // change re-measures, the same rule the engine follows.
    if (innerWidth === lastW && phoneMQ.matches) return;
    lastW = innerWidth;
    layout();
  }
  addEventListener('resize', relayout);
  addEventListener('load', function () { lastW = 0; relayout(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lastW = 0; relayout(); });
  lastW = innerWidth;
  layout();
  kick();

  // ---- navigation into the stage -------------------------------------------
  function yFor(u) {
    var top = act.getBoundingClientRect().top + scrollY;
    return top + (u / T) * (act.offsetHeight - innerHeight);
  }
  var GOTO = { hero: 0, p1: seg('p1').s + 0.2 * seg('p1').len, peak: seg('peak').s + 0.8 * seg('peak').len };
  document.querySelectorAll('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var u = GOTO[a.getAttribute('data-goto')];
      if (u == null) return;
      e.preventDefault();
      scrollTo({ top: yFor(u), behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  // Keyboard focus inside the pinned stage. The engine centres a focused
  // control, which on a sticky stage scrolls back out of the act and parks
  // every cue at 0. Park the act where that control's own copy is lit.
  addEventListener('focusin', function (e) {
    var part = e.target && e.target.closest && e.target.closest('#story [data-part]');
    if (!part) return;
    var id = part.getAttribute('data-part');
    var u = id === 'hero' ? 0 : id === 'peak' ? GOTO.peak : null;
    if (u == null) return;
    var y = yFor(u);
    if (Math.abs(scrollY - y) > 4) scrollTo({ top: y, behavior: 'instant' });
  });

  window.__story = { T: T, segs: SEGS, engine: engine };
})();
