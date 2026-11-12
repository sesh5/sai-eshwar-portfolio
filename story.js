/* ============================================================================
   story.js: the stage.

   One pinned act holds the whole story: who Sai is, every project, the
   papers, and when he can start. In each beat the question appears on one
   side and Sai's answer on the other, and the beat's illustration (scenes.js)
   occupies whichever side is empty, gliding across as the text swaps sides.

   The timeline is read from the markup: every [data-part] in order, with its
   data-kind (hero, qa, duo, peak), data-len (viewport-heights of travel) and
   data-scene. This file writes every cue window, mounts the scrollcraft
   engine (unedited), and drives the scenes from a smoothed scroll position.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phoneMQ = matchMedia('(max-width: 760px)');

  var act = document.getElementById('story');
  var bar = document.getElementById('bar');
  var stage = document.getElementById('stage');
  var layer = document.getElementById('scenes');

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var win = function (q, a, b) { return smooth((q - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---- chapter colours --------------------------------------------------------
  // g: ground, a: accent, ai: text that sits on the accent. Each project's
  // pair comes from its own world (marigold for the election, lime for the
  // healthy bowl, electric blue for the connected car). The ground stays deep
  // so the warm ink always reads; the peak inverts to saffron.
  var INK = '#f3efe6', INDIGO = '#0f1430', SAFFRON = '#ffb547';
  var PAL = {
    hero:  { g: INDIGO,    a: SAFFRON },
    meet:  { g: '#120f2e', a: SAFFRON },
    about: { g: '#10193a', a: SAFFRON },
    lens:  { g: '#17143a', a: '#c9b0ff' },
    w1:    { g: '#2a0f22', a: '#a6ec6a' },
    w2:    { g: '#1b1036', a: '#5fe0e8' },
    w3:    { g: '#0b2232', a: '#ffcf5a' },
    w4:    { g: '#211238', a: '#82c8ff' },
    w5:    { g: '#2e1216', a: '#ffb08a' },
    w6:    { g: '#0e1d33', a: '#b9a6ff' },
    w7:    { g: '#06192e', a: '#5ad1ff' },
    w8:    { g: '#1b1a0b', a: '#cdee6e' },
    w9:    { g: '#251707', a: '#ffd36b' },
    w10:   { g: '#0d2427', a: '#ff9f7a' },
    w11:   { g: '#16112f', a: '#ff95d2' },
    pubs:  { g: '#221a12', a: SAFFRON },
    peak:  { g: SAFFRON,   a: INDIGO, ink: INDIGO, ai: SAFFRON },
    paper: { g: '#eef0f5', a: '#a54f00', ink: '#141a3a', ai: '#ffffff', soft: '#4d5375' },
    close: { g: INDIGO,    a: SAFFRON }
  };
  function hx(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function toHex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function mixHex(a, b, t) { var A = hx(a), B = hx(b); return toHex(A.map(function (v, i) { return v + (B[i] - v) * t; })); }
  Object.keys(PAL).forEach(function (k) {
    var p = PAL[k];
    p.ink = p.ink || INK; p.ai = p.ai || p.g;
    p.soft = p.soft || mixHex(p.g, p.ink, 0.72);
  });
  var KEYS = ['g', 'a', 'ai', 'ink', 'soft'];
  function blend(p, q, t) {
    if (t <= 0) return p; if (t >= 1) return q;
    var o = {}; KEYS.forEach(function (k) { o[k] = mixHex(p[k], q[k], t); }); return o;
  }
  var root = document.documentElement, themeMeta = document.querySelector('meta[name="theme-color"]'), applied = {};
  function applyTheme(p) {
    KEYS.forEach(function (k) {
      if (applied[k] !== p[k]) { applied[k] = p[k]; root.style.setProperty('--' + k, p[k]); }
    });
    if (themeMeta && themeMeta.content !== p.g) themeMeta.content = p.g;
  }

  // ---- the timeline ---------------------------------------------------------
  var SEGS = [], T = 0;
  stage.querySelectorAll('[data-part]').forEach(function (el) {
    var s = {
      el: el, id: el.getAttribute('data-part'), kind: el.getAttribute('data-kind'),
      len: parseFloat(el.getAttribute('data-len')) || 1, scene: el.getAttribute('data-scene')
    };
    s.s = T; T += s.len; s.e = T;
    SEGS.push(s);
  });
  SEGS.forEach(function (s, i) { s.prev = SEGS[i - 1] || null; s.next = SEGS[i + 1] || null; });
  act.setAttribute('data-sc-span', (T + 1).toFixed(2));

  function palAt(u) {
    for (var i = 0; i < SEGS.length; i++) {
      var s = SEGS[i], n = s.next;
      if (!n) return PAL[s.id] || PAL.hero;
      // the peak's inversion happens in the empty stretch before its copy arrives
      var a = n.kind === 'peak' ? n.s + 0.02 * n.len : s.e - 0.08;
      var b = n.kind === 'peak' ? n.s + 0.26 * n.len : s.e + 0.12;
      if (u < a) return PAL[s.id] || PAL.hero;
      if (u < b) return blend(PAL[s.id] || PAL.hero, PAL[n.id] || PAL.hero, smooth((u - a) / (b - a)));
    }
    return PAL.peak;
  }

  function seg(id) { for (var i = 0; i < SEGS.length; i++) if (SEGS[i].id === id) return SEGS[i]; }
  function segAt(u) { for (var i = 0; i < SEGS.length; i++) if (u < SEGS[i].e) return SEGS[i]; return SEGS[SEGS.length - 1]; }

  // A cue window in travel units: in from a, full at `full`, leaving from
  // `fade`, gone at b. The engine takes fractions of the act.
  function cwin(a, full, fade, b) {
    var w = Math.max(b - a, 0.001);
    return [a / T, b / T, (full - a) / w, (b - fade) / w].map(function (n) {
      return clamp(n, 0, 1).toFixed(4);
    }).join(' ');
  }
  function cue(el, spec) { if (el) el.setAttribute('data-sc-cue', spec); }

  // The illustration crosses between these two points of each question beat,
  // after the question has gone and before the answer arrives.
  var CROSS_A = 0.5, CROSS_B = 0.66;

  SEGS.forEach(function (s) {
    var L = s.len, fr = s.el.querySelector('[data-cue="fr"]'), sh = s.el.querySelector('[data-cue="sh"]');
    var tail = s.next && s.next.kind === 'duo' ? 0.08 : 0.05;
    if (s.kind === 'hero') {
      // Greet: fully present on the first frame, never an empty stage.
      cue(s.el.querySelector('[data-cue="hero"]'), cwin(0, 0, 0.55 * L, 0.97 * L));
    } else if (s.kind === 'meet') {
      // The face does the talking (face.js); the narrator says hello while
      // he smiles, then moves things along once the wink is done.
      cue(s.el.querySelector('[data-cue="hi"]'), cwin(s.s + 0.04 * L, s.s + 0.12 * L, s.s + 0.56 * L, s.s + 0.64 * L));
      cue(s.el.querySelector('[data-cue="line"]'), cwin(s.s + 0.72 * L, s.s + 0.8 * L, s.s + 0.88 * L, s.s + 0.97 * L));
    } else if (s.kind === 'qa') {
      cue(fr, cwin(s.s + 0.03 * L, s.s + 0.15 * L, s.s + 0.42 * L, s.s + 0.51 * L));
      cue(sh, cwin(s.s + 0.64 * L, s.s + 0.75 * L, s.e, s.e + tail));
    } else if (s.kind === 'duo') {
      cue(fr, cwin(s.s + 0.04 * L, s.s + 0.16 * L, s.e - 0.06, s.e + 0.02));
      cue(sh, cwin(s.s + 0.12 * L, s.s + 0.22 * L, s.e - 0.06, s.e + 0.02));
    } else if (s.kind === 'peak') {
      // The ask holds to the end of the act, fully lit at p = 1.
      cue(s.el.querySelector('[data-cue="peak"]'), cwin(s.s + 0.3 * L, s.s + 0.44 * L, T, T));
    }
  });

  var engine = ScrollCraft.mount(document.body);

  // ---- scenes ---------------------------------------------------------------
  var REG = window.SCENES.registry, el = window.SCENES.el;
  var phone = false, W = 0, H = 0;

  SEGS.forEach(function (s) {
    if (!s.scene || !REG[s.scene]) return;
    var def = REG[s.scene];
    var wrap = document.createElement('div');
    wrap.className = 'scene' + (def.wide ? ' scene--wide' : '');
    wrap.setAttribute('data-for', s.id);
    layer.appendChild(wrap);
    // Each beat gets its own instance, so its state is its own.
    s.sc = Object.create(def);
    s.wrap = wrap;
  });

  function buildScenes() {
    SEGS.forEach(function (s) {
      if (!s.sc) return;
      if (s.built === phone) return;
      s.wrap.innerHTML = '';
      var svg = el('svg', { viewBox: '0 0 400 300', preserveAspectRatio: 'xMidYMid meet', role: 'presentation' }, s.wrap);
      var g = el('g', {}, svg);
      window.SCENES.setPalette(PAL[s.id]);
      s.sc.build(g, phone);
      if (s.sc.vb) svg.setAttribute('viewBox', s.sc.vb.join(' '));
      s.built = phone;
      s.sc.update(reduce ? 1 : 0, 0);
    });
  }

  function rel(e) { return { top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight }; }

  // Where each scene sits: side A while the question is up, side B while the
  // answer is up. On a desktop the sides are left and right; on a phone,
  // below the question and above the answer.
  function layout() {
    phone = phoneMQ.matches;
    W = stage.clientWidth; H = stage.clientHeight;
    buildScenes();
    var g = Math.max(20, Math.min(W * 0.05, 88)), barH = phone ? 54 : 58;

    SEGS.forEach(function (s) {
      if (!s.sc) return;
      var b;
      if (s.kind === 'peak') {
        var copy = rel(s.el.querySelector('.peak__copy'));
        var top = copy.bottom + (phone ? 26 : 40), bw = Math.min(W - 2 * g, 980), bh = Math.max(80, H - top - (phone ? 84 : 104));
        var vb = s.sc.vb, asp = vb[2] / vb[3];
        if (bw / bh > asp) bw = bh * asp; else bh = bw / asp;
        b = { w: bw, h: bh, A: [phone ? (W - bw) / 2 : g, top], B: null };
      } else if (!phone) {
        var bw2 = Math.min(W * 0.46, 680), bh2 = bw2 * 0.75;
        if (bh2 > H * 0.7) { bh2 = H * 0.7; bw2 = bh2 / 0.75; }
        var y = H * 0.52 - bh2 / 2;
        b = { w: bw2, h: bh2, A: [W * 0.745 - bw2 / 2, y], B: [W * 0.262 - bw2 / 2, y] };
      } else {
        var fr = rel(s.el.querySelector('.fr')), sh = rel(s.el.querySelector('.sh'));
        var aTop = fr.bottom + 12, aBot = H - 14, bTop = barH + 8, bBot = sh.top - 12;
        var bw3 = W - 2 * g, bh3 = Math.min(bw3 * 0.75, aBot - aTop, bBot - bTop);
        bw3 = Math.min(bw3, bh3 / 0.75);
        b = { w: bw3, h: bh3, A: [(W - bw3) / 2, (aTop + aBot) / 2 - bh3 / 2], B: [(W - bw3) / 2, (bTop + bBot) / 2 - bh3 / 2] };
      }
      s.box = b;
      s.wrap.style.width = b.w.toFixed(1) + 'px';
      s.wrap.style.height = b.h.toFixed(1) + 'px';
    });
    render(true);
  }

  // ---- scroll ---------------------------------------------------------------
  var U = 0, Us = 0, t0 = performance.now(), lastGlow = '', snapNext = false;
  var closeEl = document.getElementById('contact'), barH0 = 58;

  // Which palette the page wears right now: the story's blend while the act is
  // on screen, then paper, then the indigo bookend under the bar.
  function theme() {
    var r = act.getBoundingClientRect();
    if (r.bottom > barH0) { applyTheme(palAt(Us)); return; }
    applyTheme(closeEl && closeEl.getBoundingClientRect().top < barH0 ? PAL.close : PAL.paper);
  }
  var heroLayers = [['.hero__who', 14], ['.hero__a', 30], ['.hero__b', 44], ['.hero__sub', 20], ['.hero__offer', 58]].map(function (x) {
    return { el: stage.querySelector(x[0]), r: x[1] };
  });

  function readU() {
    var r = act.getBoundingClientRect();
    var travel = Math.max(act.offsetHeight - innerHeight, 1);
    U = clamp(-r.top / travel, 0, 1) * T;
    bar.classList.toggle('bar--solid', r.bottom < 70);
    return r;
  }

  function render(snap) {
    readU();
    // A smoothed playhead, so a notched wheel still reads as one glide.
    if (snapNext) { snap = true; snapNext = false; }
    Us = snap || reduce ? U : Us + (U - Us) * 0.16;
    if (Math.abs(U - Us) < 0.0004) Us = U;
    var t = reduce ? 0 : (performance.now() - t0) / 1000;
    var cur = segAt(Us), sig = cur.id, glow = null;

    SEGS.forEach(function (s) {
      if (!s.sc || !s.box) return;
      var q = (Us - s.s) / s.len;
      var near = q > -0.15 && q < 1.15;
      if (!near) { if (s.shown !== false) { s.wrap.style.opacity = '0'; s.wrap.style.display = 'none'; s.shown = false; } return; }
      var qc = clamp(q, 0, 1), alpha, x, y, sc = 1;
      if (s.kind === 'peak') {
        alpha = win(q, 0.2, 0.34);
        x = s.box.A[0]; y = s.box.A[1] + (1 - alpha) * 16;
      } else {
        alpha = Math.min(win(q, -0.02, 0.08), 1 - win(q, 0.95, 1.05));
        var m = reduce ? (q < 0.58 ? 0 : 1) : win(q, CROSS_A, CROSS_B);
        x = lerp(s.box.A[0], s.box.B[0], m); y = lerp(s.box.A[1], s.box.B[1], m);
        sc = 1 - 0.07 * Math.sin(Math.PI * m);
        if (reduce) alpha *= 1 - 0.85 * Math.sin(Math.PI * clamp((q - 0.53) / 0.1, 0, 1));
      }
      if (!s.shown) { s.wrap.style.display = 'block'; s.shown = true; }
      s.wrap.style.opacity = alpha.toFixed(3);
      s.wrap.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
      // Under reduced motion each scene shows its resolved state.
      window.SCENES.setPalette(PAL[s.id]);
      s.sc.update(reduce ? 1 : qc, t);
      if (s === cur) glow = (x + s.box.w / 2) / W * 100;
      if (s === cur) sig = s.id + ':' + qc.toFixed(2);
    });

    // The portrait: its own beat, its own clock for the blinks.
    var meet = seg('meet');
    if (meet && window.FACE) {
      var fs = window.FACE.update((Us - meet.s) / meet.len, (performance.now() - t0) / 1000, phone, W, H);
      if (cur === meet) sig = 'meet:' + fs;
    }

    // The hero's layers drift apart at different rates as the page starts to
    // move: depth from differential motion, and never a dead first scroll.
    if (!reduce) {
      var hq = clamp(Us / seg('hero').len, 0, 1.2);
      var damp = phone ? 0.35 : 1;
      heroLayers.forEach(function (h) { h.el.style.transform = 'translate3d(0,' + (-hq * h.r * damp).toFixed(2) + 'px,0)'; });
      if (cur.kind === 'hero') sig = 'hero:' + hq.toFixed(2);
    }

    // The chapter's colours, the glow behind its illustration, and the dock.
    theme();
    if (glow != null) {
      var gx = glow.toFixed(1) + '%';
      if (gx !== lastGlow) { lastGlow = gx; stage.style.setProperty('--glow-x', gx); }
    }
    dockUpdate(cur, Us);

    // Tell the verification harness what is actually painted.
    stage.setAttribute('data-sc-verify-state', sig);
    var cq = (Us - cur.s) / cur.len;
    var hold = reduce || (cur.kind === 'peak' && cq > 0.9) || (cur.kind === 'duo' && cq > 0.22 && cq < 0.95);
    if (hold) stage.setAttribute('data-sc-verify-hold', 'true'); else stage.removeAttribute('data-sc-verify-hold');
  }

  // ---- loop: only while the stage can be seen ------------------------------
  var running = false;
  function visible() {
    var r = act.getBoundingClientRect();
    return r.bottom > -40 && r.top < innerHeight + 40 && !document.hidden;
  }
  function loop() {
    if (!visible()) { running = false; return; }
    render(false);
    requestAnimationFrame(loop);
  }
  function kick() {
    if (reduce) { render(true); return; }
    if (!running && visible()) { running = true; requestAnimationFrame(loop); }
  }
  addEventListener('scroll', function () { if (!running) { readU(); theme(); dockVis(); } kick(); }, { passive: true });
  document.addEventListener('visibilitychange', kick);

  // ---- the dock: where you are, and a way to jump anywhere ------------------
  // One tick per chapter. A recruiter who only wants project 7 should not have
  // to scroll through six others to reach it.
  var dock = document.getElementById('dock');
  var dockN = dock.querySelector('.dock__n'), dockT = dock.querySelector('.dock__t');
  var dockPrev = dock.querySelector('[data-step="-1"]'), dockNext = dock.querySelector('[data-step="1"]');
  var CH = SEGS.filter(function (s) { return s.kind !== 'hero'; });
  var PROJ = SEGS.filter(function (s) { return /^w\d+$/.test(s.id); });
  var ticksEl = dock.querySelector('.dock__ticks');
  CH.forEach(function (s) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dock__tick';
    b.setAttribute('aria-label', 'Go to ' + s.el.getAttribute('data-label'));
    b.title = s.el.getAttribute('data-label');
    b.innerHTML = '<span></span>';
    var c = (PAL[s.id] || PAL.hero).a;
    if (s.kind === 'peak') c = SAFFRON;
    b.style.setProperty('--c', c);
    b.addEventListener('click', function () { jumpTo(s); });
    li.appendChild(b); ticksEl.appendChild(li);
    s.tick = b.firstChild;
  });
  // Where a jump lands in each chapter: the moment its question is fully lit.
  function landing(s) {
    var q = { meet: 0.3, lens: 0.6, peak: 0.95 }[s.id];
    return s.s + (q == null ? 0.2 : q) * s.len;
  }
  function yForU(u) {
    var top = act.getBoundingClientRect().top + scrollY;
    return top + (u / T) * (act.offsetHeight - innerHeight);
  }
  function jumpTo(s) {
    snapNext = true;
    scrollTo({ top: yForU(landing(s)), behavior: 'instant' });
    kick();
  }
  function chapterIndex(u) {
    var c = segAt(u);
    return c.kind === 'hero' ? -1 : CH.indexOf(c);
  }
  dock.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = chapterIndex(Us) + Number(b.getAttribute('data-step'));
      if (i < 0) { scrollTo({ top: yForU(0), behavior: 'instant' }); snapNext = true; kick(); return; }
      if (i < CH.length) jumpTo(CH[i]);
    });
  });
  var dockOn = false, dockKey = '';
  function dockVis() {
    var r = act.getBoundingClientRect();
    var on = U > SEGS[0].len * 0.7 && r.bottom > innerHeight * 0.6;
    if (on !== dockOn) { dockOn = on; dock.classList.toggle('is-on', on); }
  }
  function dockUpdate(cur, u) {
    dockVis();
    var i = CH.indexOf(cur);
    CH.forEach(function (s, k) {
      var p = k < i ? 1 : k > i ? 0 : clamp((u - s.s) / s.len, 0, 1);
      var v = p.toFixed(3);
      if (s.tickP !== v) { s.tickP = v; s.tick.style.setProperty('--p', v); }
    });
    var key = cur.id;
    if (key === dockKey) return;
    dockKey = key;
    var pi = PROJ.indexOf(cur);
    dockN.textContent = pi >= 0 ? 'Project ' + (pi + 1) + ' of ' + PROJ.length : '';
    dockT.textContent = cur.kind === 'hero' ? 'Start' : cur.el.getAttribute('data-label');
    dockPrev.disabled = cur.kind === 'hero';
    dockNext.disabled = i === CH.length - 1;
  }
  // Arrow keys step through chapters while the story is on screen.
  addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var cli = document.getElementById('cliOverlay');
    if (cli && cli.classList.contains('open')) return;
    var r = act.getBoundingClientRect();
    if (r.bottom < innerHeight * 0.5 || r.top > 0) return;
    e.preventDefault();
    (e.key === 'ArrowRight' ? dockNext : dockPrev).click();
  });

  // ---- the hero's one moment: "friction" arrives mis-set and snaps into line
  var heroPart = stage.querySelector('.hero');
  (function () {
    var fx = stage.querySelector('.fx');
    if (!fx) return;
    var word = fx.textContent, R = 7;
    var rnd = function () { R = (R * 16807) % 2147483647; return (R - 1) / 2147483646; };
    fx.textContent = '';
    var sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = word; fx.appendChild(sr);
    var vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true'); fx.appendChild(vis);
    word.split('').forEach(function (ch, i) {
      var l = document.createElement('i'); l.textContent = ch;
      if (!reduce) {
        l.style.setProperty('--x', ((i ? rnd() - 0.5 : rnd() * 0.5) * 0.12).toFixed(3) + 'em');
        l.style.setProperty('--y', ((rnd() - 0.5) * 0.22).toFixed(3) + 'em');
        l.style.setProperty('--r', ((rnd() - 0.5) * 22).toFixed(1) + 'deg');
        l.style.setProperty('--d', (i * 45) + 'ms');
      }
      vis.appendChild(l);
    });
    stage.querySelectorAll('.offer__cal li').forEach(function (li, i) { li.style.setProperty('--i', i); });
    root.classList.add('js-hero');
    var shipped = false;
    function ship() { if (shipped) return; shipped = true; heroPart.classList.add('is-shipped'); }
    if (reduce) { ship(); return; }
    var go = function () { setTimeout(ship, 650); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    addEventListener('scroll', ship, { once: true, passive: true });
  })();

  // ---- the record: each project row wears its chapter colour and can replay it
  document.querySelectorAll('.gl__row').forEach(function (row) {
    var s = seg(row.getAttribute('data-chapter'));
    if (!s) return;
    var a = PAL[s.id].a;
    row.style.setProperty('--c', a);
    var b = row.querySelector('[data-jump]');
    if (b) b.addEventListener('click', function () { jumpTo(s); });
  });

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
    document.querySelectorAll('[data-role]').forEach(function (e) { e.classList.toggle('is-picked', !!mark && e.getAttribute('data-role') === key); });
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
  var GOTO = { hero: 0, about: at('about', 0.2), work: at('w1', 0.2), pubs: at('pubs', 0.2), peak: at('peak', 0.95) };
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
  var PARK = { hero: 0, lens: at('lens', 0.6), pubs: at('pubs', 0.9), peak: GOTO.peak };
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
