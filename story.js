/* ============================================================================
   story.js: the split stage.

   One pinned act holds the whole story: who Sai is, every project, the
   papers, and when he can start. A seam divides the stage. The friction side
   is the narrator, sceptical, with a field of dots drifting in no order. The
   shipped side is Sai answering, on a clean ground. Scroll moves the seam, and
   the seam sweeps the friction dots out of its way.

   The timeline is read from the markup: every [data-part] in order, with its
   data-kind (hero, qa, duo, quiet, peak) and data-len (viewport-heights of
   travel). This file writes every cue window, mounts the scrollcraft engine
   (unedited), then draws the field from the act's scroll position.
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

  // ---- the timeline ---------------------------------------------------------
  var SEGS = [], T = 0;
  stage.querySelectorAll('[data-part]').forEach(function (el) {
    var s = { el: el, id: el.getAttribute('data-part'), kind: el.getAttribute('data-kind'), len: parseFloat(el.getAttribute('data-len')) || 1 };
    s.s = T; T += s.len; s.e = T;
    SEGS.push(s);
  });
  SEGS.forEach(function (s, i) { s.prev = SEGS[i - 1] || null; s.next = SEGS[i + 1] || null; });
  act.setAttribute('data-sc-span', (T + 1).toFixed(2));

  function seg(id) { for (var i = 0; i < SEGS.length; i++) if (SEGS[i].id === id) return SEGS[i]; }
  function segAt(u) { for (var i = 0; i < SEGS.length; i++) if (u < SEGS[i].e) return SEGS[i]; return SEGS[SEGS.length - 1]; }

  // A cue window in travel units: in from a, full at `full`, leaving from
  // `fade`, gone at b. The engine takes fractions of the act.
  function win(a, full, fade, b) {
    var w = Math.max(b - a, 0.001);
    return [a / T, b / T, (full - a) / w, (b - fade) / w].map(function (n) {
      return clamp(n, 0, 1).toFixed(4);
    }).join(' ');
  }
  function cue(el, spec) { if (el) el.setAttribute('data-sc-cue', spec); }

  SEGS.forEach(function (s) {
    var L = s.len, fr = s.el.querySelector('[data-cue="fr"]'), sh = s.el.querySelector('[data-cue="sh"]');
    // How long after this beat ends its shipped copy may linger: it must be
    // gone before the next beat's seam crosses where it sits.
    var tail = s.next && s.next.kind === 'duo' ? 0.08 : 0.05;
    if (s.kind === 'hero') {
      // Greet: fully present on the first frame. Never an empty stage.
      cue(s.el.querySelector('[data-cue="hero"]'), win(0, 0, 0.6 * L, 0.94 * L));
    } else if (s.kind === 'qa') {
      // Question first, then the answer as the seam sweeps across.
      cue(fr, win(s.s + 0.03 * L, s.s + 0.15 * L, s.s + 0.47 * L, s.s + 0.57 * L));
      cue(sh, win(s.s + 0.60 * L, s.s + 0.72 * L, s.e, s.e + tail));
    } else if (s.kind === 'duo') {
      // Both sides at once: the question with its controls, and the answer.
      cue(fr, win(s.s + 0.06 * L, s.s + 0.2 * L, s.e - 0.06, s.e + 0.02));
      cue(sh, win(s.s + 0.16 * L, s.s + 0.3 * L, s.e - 0.06, s.e + 0.02));
    } else if (s.kind === 'peak') {
      // The ask holds to the end of the act, fully lit at p = 1.
      cue(s.el.querySelector('[data-cue="peak"]'), win(s.s + 0.42 * L, s.s + 0.56 * L, T, T));
    }
  });

  var engine = ScrollCraft.mount(document.body);

  // ---- the seam -------------------------------------------------------------
  // D is where the seam sits, as a fraction of the stage: of its width on a
  // desktop, of its height on a phone. Friction owns [0, D], shipped [D, 1].
  // Every hold still creeps a little, so no stretch of scroll is dead.
  var G = { DS: 0.68, DE: 0.36, DM: 0.5, Dh: 0.5, creep: 0.03 };
  var phone = false;

  function seamEnd(s) {
    if (!s) return G.Dh;
    if (s.kind === 'hero') return G.Dh + G.creep;
    if (s.kind === 'qa') return (s.endD || G.DE) - 0.02;
    if (s.kind === 'duo') return G.DM - 0.012;
    if (s.kind === 'quiet') return 1;
    return 0;
  }
  function seamAt(u) {
    var s = segAt(u), q = clamp((u - s.s) / s.len, 0, 1), from = seamEnd(s.prev);
    if (s.kind === 'hero') return G.Dh + G.creep * smooth(q);
    if (s.kind === 'qa') {
      var DS = s.startD || G.DS, DE = s.endD || G.DE;
      var hiD = DS + 0.02, loD = DS - 0.02;
      if (q < 0.12) return lerp(from, hiD, smooth(q / 0.12));
      if (q < 0.40) return lerp(hiD, loD, (q - 0.12) / 0.28);
      if (q < 0.75) return lerp(loD, DE, smooth((q - 0.40) / 0.35));
      return lerp(DE, DE - 0.02, (q - 0.75) / 0.25);
    }
    if (s.kind === 'duo') {
      if (q < 0.15) return lerp(from, G.DM + 0.012, smooth(q / 0.15));
      return lerp(G.DM + 0.012, G.DM - 0.012, (q - 0.15) / 0.85);
    }
    if (s.kind === 'quiet') return q < 0.6 ? lerp(from, 1, smooth(q / 0.6)) : 1;
    return q < 0.55 ? lerp(1, 0, smooth(q / 0.55)) : 0;
  }

  // ---- friction: dots in a flow field, confined to their side --------------
  var N = 1300;
  var px = new Float32Array(N), py = new Float32Array(N);
  var cx = new Float32Array(N), cy = new Float32Array(N);
  var al = new Float32Array(N), seedR = new Float32Array(N);
  for (var i = 0; i < N; i++) seedR[i] = Math.random();

  var W = 0, H = 0, dpr = 1, U = 0, Dcur = 0.5, t0 = performance.now(), started = false;

  function rel(el) { return { top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }; }

  function layout() {
    phone = phoneMQ.matches;
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    stage.classList.toggle('is-phone', phone);

    G.DS = phone ? 0.64 : 0.68;
    G.DE = phone ? 0.40 : 0.36;
    G.DM = 0.5;
    G.creep = phone ? 0.012 : 0.03;
    if (phone) {
      // The hero's seam runs between the two halves of the headline.
      var a = stage.querySelector('.hero__a').getBoundingClientRect();
      var b = stage.querySelector('.hero__b').getBoundingClientRect();
      var st = stage.getBoundingClientRect();
      G.Dh = clamp(((a.bottom + b.top) / 2 - st.top) / H, 0.2, 0.8);
      // A duo beat splits just under its question block.
      var lensEl = seg('lens').el, fr = rel(lensEl.querySelector('.fr'));
      G.DM = clamp((fr.bottom + 22) / H, 0.4, 0.62);
      // and its answer sits right under the seam, not at the foot of the screen
      var lsh = lensEl.querySelector('.sh');
      lsh.style.top = Math.round(G.DM * H + 26) + 'px'; lsh.style.bottom = 'auto';
    } else {
      G.Dh = 0.5;
      var lsh2 = seg('lens').el.querySelector('.sh');
      lsh2.style.top = ''; lsh2.style.bottom = '';
    }

    // On a phone each beat sizes its own seam: the answer sits just under it,
    // and the question always fits above where it starts.
    SEGS.forEach(function (s) {
      s.startD = s.endD = 0;
      if (s.kind !== 'qa' || !phone) return;
      var fr = rel(s.el.querySelector('.fr')), sh = rel(s.el.querySelector('.sh'));
      s.endD = clamp((sh.top - 30) / H, 0.16, 0.46);
      s.startD = clamp(Math.max(G.DS, (fr.bottom + 28) / H), s.endD + 0.12, 0.8);
    });

    if (!started) {
      // Pour every dot out of the seam on first paint.
      for (var i = 0; i < N; i++) {
        var along = seedR[i] * (phone ? W : H);
        if (phone) { px[i] = along; py[i] = H * G.Dh; } else { px[i] = W * G.Dh; py[i] = along; }
        respawn(i, true);
        if (reduce) { px[i] = cx[i]; py[i] = cy[i]; }
      }
      started = true;
    }
    draw();
  }

  function respawn(i, keep) {
    var Dpx = (phone ? H : W) * Dcur;
    var lo = phone ? 64 : 10, hi = Math.max(lo + 2, Dpx - 10);
    var a = lo + Math.random() * (hi - lo), o = Math.random() * (phone ? W : H);
    if (phone) { cx[i] = o; cy[i] = a; } else { cx[i] = a; cy[i] = o; }
    if (!keep) { px[i] = cx[i]; py[i] = cy[i]; al[i] = 0; }
  }

  function flow(x, y, t) {
    return Math.sin(x * 0.0061 + t * 0.37) * 2.1 + Math.cos(y * 0.0073 - t * 0.29) * 1.7 + Math.sin((x - y) * 0.0042 + t * 0.21) * 1.3;
  }

  // ---- scroll ---------------------------------------------------------------
  function read() {
    var r = act.getBoundingClientRect();
    var travel = Math.max(act.offsetHeight - innerHeight, 1);
    U = clamp(-r.top / travel, 0, 1) * T;
    var s = segAt(U), D = seamAt(U), q = (U - s.s) / s.len;
    stage.classList.toggle('in-hero', s.kind === 'hero');
    bar.classList.toggle('bar--solid', r.bottom < 70);
    // Tell the verification harness what the stage is actually showing.
    stage.setAttribute('data-sc-verify-state', s.id + ':' + D.toFixed(2));
    // Authored holds: the resolved ask, and the role switch, where the page
    // waits for a click rather than a scroll.
    if ((s.kind === 'peak' && q > 0.54) || (s.kind === 'duo' && q > 0.3 && q < 0.95)) stage.setAttribute('data-sc-verify-hold', 'true');
    else stage.removeAttribute('data-sc-verify-hold');
    return D;
  }

  var rects = [];
  function quietRects() {
    // Dots dim wherever copy is on screen, so type always sits on a quiet patch.
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

  var FR_GROUND = '#0a0b0d', SH_GROUND = '#0b110e';

  function draw() {
    var t = (performance.now() - t0) / 1000;
    var Dt = read();
    Dcur = reduce ? Dt : lerp(Dcur, Dt, 0.22);
    stage.style.setProperty('--d', Dcur.toFixed(4));
    var size = phone ? H : W, Dpx = size * Dcur;
    quietRects();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = FR_GROUND;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = SH_GROUND;
    if (phone) ctx.fillRect(0, Dpx, W, H - Dpx); else ctx.fillRect(Dpx, 0, W - Dpx, H);

    var spd = phone ? 0.5 : 0.7, lo = phone ? 64 : 10, hi = Dpx - 10, room = hi > lo + 4;
    var z = phone ? 1.6 : 1.9;
    ctx.fillStyle = '#8f8f88';
    for (var i = 0; i < N; i++) {
      if (!reduce) {
        var ang = flow(cx[i], cy[i], t) * 1.1 + seedR[i] * 0.6;
        cx[i] += Math.cos(ang) * spd; cy[i] += Math.sin(ang) * spd;
      }
      var a = phone ? cy[i] : cx[i], o = phone ? cx[i] : cy[i], lim = phone ? W : H;
      // Out of bounds: nudge back, and now and then lift the dot out and drop
      // it somewhere fresh, so friction never packs into a wall at the seam.
      var out = false;
      if (room) {
        if (a > hi) { a -= (a - hi) * 0.3 + 0.8; out = a > hi + 24 || Math.random() < 0.06; }
        if (a < lo) { a = lo + (lo - a) * 0.5 + 0.5; out = out || Math.random() < 0.06; }
      }
      if (phone) cy[i] = a; else cx[i] = a;
      if (room && (out || o < 2 || o > lim - 2)) respawn(i, false);
      var k = reduce ? 1 : 0.16;
      px[i] += (cx[i] - px[i]) * k; py[i] += (cy[i] - py[i]) * k;
      var want = room ? 0.6 : 0;
      al[i] = reduce ? want : al[i] + (want - al[i]) * 0.14;
      var alpha = al[i] * quiet(px[i], py[i]);
      if (alpha < 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillRect(px[i] - z / 2, py[i] - z / 2, z, z);
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

  // ---- the lens: what is the visitor hiring for? ---------------------------
  // The choice rewrites the About answer, marks the role wherever it is
  // listed, and puts it in the subject line of every email link on the page.
  var ROLE = { pm: 'Product Management', da: 'Data Analyst', ba: 'Business Analyst' };
  function setLens(key, remember, mark) {
    if (!ROLE[key]) key = 'pm';
    document.querySelectorAll('.lens__b').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lens') === key)); });
    document.querySelectorAll('.lens__text [data-for]').forEach(function (p) { p.hidden = p.getAttribute('data-for') !== key; });
    // A role is marked elsewhere only once the visitor has actually chosen it.
    document.querySelectorAll('[data-role]').forEach(function (el) { el.classList.toggle('is-picked', !!mark && el.getAttribute('data-role') === key); });
    var subject = encodeURIComponent('Internship enquiry: ' + ROLE[key] + ' (Dec 2026 to Dec 2027)');
    document.querySelectorAll('[data-mail]').forEach(function (a) { a.href = 'mailto:seshwarsai@gmail.com?subject=' + subject; });
    if (remember) { try { localStorage.setItem('sai-lens', key); } catch (e) {} }
  }
  var saved = null;
  try { saved = localStorage.getItem('sai-lens'); } catch (e) {}
  setLens(saved || 'pm', false, !!saved);
  document.querySelectorAll('.lens__b').forEach(function (b) {
    b.addEventListener('click', function () { setLens(b.getAttribute('data-lens'), true, true); });
  });

  // ---- navigation into the stage -------------------------------------------
  function yFor(u) {
    var top = act.getBoundingClientRect().top + scrollY;
    return top + (u / T) * (act.offsetHeight - innerHeight);
  }
  function at(id, q) { var s = seg(id); return s.s + q * s.len; }
  var GOTO = { hero: 0, about: at('about', 0.2), work: at('w1', 0.2), pubs: at('pubs', 0.2), peak: at('peak', 0.8) };
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
  var PARK = { hero: 0, lens: at('lens', 0.6), pubs: at('pubs', 0.88), peak: GOTO.peak };
  addEventListener('focusin', function (e) {
    var part = e.target && e.target.closest && e.target.closest('#story [data-part]');
    if (!part) return;
    var u = PARK[part.getAttribute('data-part')];
    if (u == null) return;
    var y = yFor(u);
    if (Math.abs(scrollY - y) > 4) scrollTo({ top: y, behavior: 'instant' });
  });

  window.__story = { T: T, segs: SEGS.map(function (s) { return { id: s.id, kind: s.kind, s: s.s, len: s.len }; }), engine: engine };
})();
